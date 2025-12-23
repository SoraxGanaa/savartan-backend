import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";

import { config } from "./config";
import { jwtPlugin } from "./plugins/jwt";
import { authGuardPlugin } from "./plugins/authGuard";
import { authRoutes } from "./modules/auth/auth.routes";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(sensible);

  await app.register(cookie, {
    secret: config.JWT_SECRET, // ok for signing cookies if you want, but not required
    hook: "onRequest"
  });

  await app.register(jwtPlugin);
  await app.register(authGuardPlugin);

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);

  return app;
}
