import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  ssl: { rejectUnauthorized: false } 
});


// Optional: test connection on startup
pool.connect()
  .then(() => console.log("✅ PostgreSQL connected"))
  .catch(err => {
    console.error("❌ PostgreSQL connection failed", err);
    process.exit(1);
  });
