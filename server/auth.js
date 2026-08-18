import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config({ path: new URL(".env", import.meta.url) });

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing required environment variable: JWT_SECRET");
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function requireAuth(req, res, next) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (!token) {
    return res.status(401).json({ error: "需要先登录。" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      username: payload.username,
      displayName: payload.displayName,
    };
    return next();
  } catch {
    return res.status(401).json({ error: "登录状态已失效，请重新登录。" });
  }
}
