import dotenv from "dotenv";
import sql from "mssql";

dotenv.config({ path: new URL(".env", import.meta.url) });

const useTrustedConnection = process.env.DB_TRUSTED_CONNECTION === "true";
const required = useTrustedConnection
  ? ["DB_SERVER", "DB_DATABASE"]
  : ["DB_SERVER", "DB_DATABASE", "DB_USER", "DB_PASSWORD"];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const config = {
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT ?? 1433),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
    trustedConnection: useTrustedConnection,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

if (!useTrustedConnection) {
  config.user = process.env.DB_USER;
  config.password = process.env.DB_PASSWORD;
}

let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

export { sql };
