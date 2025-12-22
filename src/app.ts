import Fastify from "fastify";
import { pool } from "./plugins/db.js";

export const app = Fastify({ logger: true });

app.get("/health", async () => {
  const result = await pool.query("SELECT NOW()");
  return {
    status: "ok",
    dbTime: result.rows[0],
  };
});
