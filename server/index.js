import bcrypt from "bcryptjs";
import cors from "cors";
import { randomUUID } from "crypto";
import express from "express";
import { promises as fs } from "fs";
import { requireAuth, signToken } from "./auth.js";
import { getPool, sql } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const discussionStoreUrl = new URL("./discussion-comments.json", import.meta.url);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

function normalizeDisplayName(displayName, username) {
  return String(displayName ?? "").trim() || username;
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
  };
}

function publicComment(row) {
  return {
    id: row.id,
    movieId: row.movie_id,
    parentId: row.parent_id,
    author: row.author,
    text: row.text,
    likes: row.likes,
    likedByMe: false,
    createdAt: row.created_at,
  };
}

async function readDiscussionStore() {
  try {
    const raw = await fs.readFile(discussionStoreUrl, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.comments) ? data.comments : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeDiscussionStore(comments) {
  await fs.writeFile(
    discussionStoreUrl,
    JSON.stringify({ comments }, null, 2),
    "utf8",
  );
}

async function listFileComments(movieId) {
  const comments = await readDiscussionStore();
  return comments
    .filter((comment) => comment.movieId === movieId)
    .sort((a, b) => {
      if (!a.parentId && b.parentId) return -1;
      if (a.parentId && !b.parentId) return 1;
      return b.likes - a.likes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

async function addFileComment({ movieId, parentId, author, text }) {
  const comments = await readDiscussionStore();
  const comment = {
    id: randomUUID(),
    movieId,
    parentId,
    author,
    text,
    likes: 0,
    likedByMe: false,
    createdAt: new Date().toISOString(),
  };
  comments.push(comment);
  await writeDiscussionStore(comments);
  return comment;
}

async function likeFileComment({ movieId, commentId, delta }) {
  const comments = await readDiscussionStore();
  const comment = comments.find((item) => item.id === commentId && item.movieId === movieId);
  if (!comment) return null;
  comment.likes = Math.max(0, Number(comment.likes || 0) + delta);
  await writeDiscussionStore(comments);
  return comment;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/discussions/:movieId", async (req, res, next) => {
  try {
    const movieId = String(req.params.movieId ?? "").trim();
    if (!movieId) return res.status(400).json({ error: "缺少影片 ID。" });

    const pool = await getPool();
    const result = await pool
      .request()
      .input("movieId", sql.NVarChar(80), movieId)
      .query(`
        SELECT TOP 300 id, movie_id, parent_id, author, text, likes, created_at
        FROM dbo.DiscussionComments
        WHERE movie_id = @movieId
        ORDER BY
          CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
          likes DESC,
          created_at DESC
      `);

    res.json({ comments: result.recordset.map(publicComment) });
  } catch (error) {
    try {
      const movieId = String(req.params.movieId ?? "").trim();
      res.json({ comments: await listFileComments(movieId) });
    } catch (fileError) {
      next(fileError);
    }
  }
});

app.post("/api/discussions/:movieId", async (req, res, next) => {
  try {
    const movieId = String(req.params.movieId ?? "").trim();
    const text = String(req.body?.text ?? "").trim();
    const author = String(req.body?.author ?? "").trim().slice(0, 80) || "游客";
    const parentId = req.body?.parentId || null;

    if (!movieId) return res.status(400).json({ error: "缺少影片 ID。" });
    if (!text || text.length > 1000) return res.status(400).json({ error: "评论需为 1-1000 字。" });

    const pool = await getPool();
    const result = await pool
      .request()
      .input("movieId", sql.NVarChar(80), movieId)
      .input("parentId", sql.UniqueIdentifier, parentId)
      .input("author", sql.NVarChar(80), author)
      .input("text", sql.NVarChar(1000), text)
      .query(`
        INSERT INTO dbo.DiscussionComments (movie_id, parent_id, author, text)
        OUTPUT INSERTED.id, INSERTED.movie_id, INSERTED.parent_id, INSERTED.author, INSERTED.text, INSERTED.likes, INSERTED.created_at
        VALUES (@movieId, @parentId, @author, @text)
      `);

    res.status(201).json({ comment: publicComment(result.recordset[0]) });
  } catch (error) {
    try {
      const movieId = String(req.params.movieId ?? "").trim();
      const text = String(req.body?.text ?? "").trim();
      const author = String(req.body?.author ?? "").trim().slice(0, 80) || "Guest";
      const parentId = req.body?.parentId || null;
      if (!movieId) return res.status(400).json({ error: "Missing movie id." });
      if (!text || text.length > 1000) return res.status(400).json({ error: "Comment must be 1-1000 characters." });
      const comment = await addFileComment({ movieId, parentId, author, text });
      res.status(201).json({ comment });
    } catch (fileError) {
      next(fileError);
    }
  }
});

app.post("/api/discussions/:movieId/:commentId/like", async (req, res, next) => {
  try {
    const movieId = String(req.params.movieId ?? "").trim();
    const commentId = String(req.params.commentId ?? "").trim();
    const delta = req.body?.delta === -1 ? -1 : 1;

    const pool = await getPool();
    const result = await pool
      .request()
      .input("movieId", sql.NVarChar(80), movieId)
      .input("commentId", sql.UniqueIdentifier, commentId)
      .input("delta", sql.Int, delta)
      .query(`
        UPDATE dbo.DiscussionComments
        SET likes = CASE WHEN likes + @delta < 0 THEN 0 ELSE likes + @delta END
        OUTPUT INSERTED.id, INSERTED.movie_id, INSERTED.parent_id, INSERTED.author, INSERTED.text, INSERTED.likes, INSERTED.created_at
        WHERE id = @commentId AND movie_id = @movieId
      `);

    if (!result.recordset.length) return res.status(404).json({ error: "评论不存在。" });
    res.json({ comment: publicComment(result.recordset[0]) });
  } catch (error) {
    try {
      const movieId = String(req.params.movieId ?? "").trim();
      const commentId = String(req.params.commentId ?? "").trim();
      const delta = req.body?.delta === -1 ? -1 : 1;
      const comment = await likeFileComment({ movieId, commentId, delta });
      if (!comment) return res.status(404).json({ error: "Comment not found." });
      res.json({ comment });
    } catch (fileError) {
      next(fileError);
    }
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password ?? "");
    const displayName = normalizeDisplayName(req.body.displayName, username);

    if (!/^[a-z0-9_@.-]{3,40}$/.test(username)) {
      return res.status(400).json({ error: "用户名需为 3-40 位，可包含字母、数字、下划线、点、横线或 @。" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "密码至少需要 6 位。" });
    }

    const pool = await getPool();
    const existing = await pool
      .request()
      .input("username", sql.NVarChar(80), username)
      .query("SELECT id FROM dbo.Users WHERE username = @username");

    if (existing.recordset.length) {
      return res.status(409).json({ error: "这个用户名已经被注册。" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool
      .request()
      .input("username", sql.NVarChar(80), username)
      .input("passwordHash", sql.NVarChar(255), passwordHash)
      .input("displayName", sql.NVarChar(80), displayName)
      .query(`
        INSERT INTO dbo.Users (username, password_hash, display_name)
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.display_name
        VALUES (@username, @passwordHash, @displayName)
      `);

    const user = publicUser(result.recordset[0]);
    res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password ?? "");

    const pool = await getPool();
    const result = await pool
      .request()
      .input("username", sql.NVarChar(80), username)
      .query("SELECT id, username, display_name, password_hash FROM dbo.Users WHERE username = @username");

    const row = result.recordset[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: "用户名或密码不正确。" });
    }

    const user = publicUser(row);
    res.json({ token: signToken(user), user });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/state", requireAuth, async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("userId", sql.UniqueIdentifier, req.user.id)
      .query("SELECT state_json FROM dbo.UserAppStates WHERE user_id = @userId");

    const raw = result.recordset[0]?.state_json;
    res.json({ state: raw ? JSON.parse(raw) : null });
  } catch (error) {
    next(error);
  }
});

app.put("/api/state", requireAuth, async (req, res, next) => {
  try {
    const state = req.body?.state;
    if (!state || typeof state !== "object") {
      return res.status(400).json({ error: "缺少有效的 state 数据。" });
    }

    const pool = await getPool();
    await pool
      .request()
      .input("userId", sql.UniqueIdentifier, req.user.id)
      .input("stateJson", sql.NVarChar(sql.MAX), JSON.stringify(state))
      .query(`
        MERGE dbo.UserAppStates AS target
        USING (SELECT @userId AS user_id, @stateJson AS state_json) AS source
        ON target.user_id = source.user_id
        WHEN MATCHED THEN
          UPDATE SET state_json = source.state_json, updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (user_id, state_json) VALUES (source.user_id, source.state_json);
      `);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "服务器处理失败，请稍后重试。" });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`CineList API listening on http://127.0.0.1:${port}`);
});
