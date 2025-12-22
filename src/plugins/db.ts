import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

// Optional: test connection on startup
pool.connect()
  .then(() => console.log("✅ PostgreSQL connected"))
  .catch(err => {
    console.error("❌ PostgreSQL connection failed", err);
    process.exit(1);
  });
