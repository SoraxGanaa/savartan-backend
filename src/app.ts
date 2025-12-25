import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";

import { config } from "./config";
import { jwtPlugin } from "./plugins/jwt";
import { authGuardPlugin } from "./plugins/authGuard";
import { authRoutes } from "./modules/auth/auth.routes";
import { petsRoutes } from "./modules/pets/pets.routes";
import multipart from "@fastify/multipart";
import { uploadRoutes } from "./modules/uploads/upload.routes";
import { profileRoutes } from "./modules/profile/profile.routes";

import cors from "@fastify/cors";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: (origin, cb) => {
      // allow server-to-server, curl, postman (no origin header)
      if (!origin) return cb(null, true);

      const allowList = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://savartan-web.vercel.app",
      ];

      // allow vercel preview deployments like:
      // https://savartan-frontend-git-xxx.vercel.app
      const vercelPreview = /^https:\/\/savartan-web.*\.vercel\.app$/;

      if (allowList.includes(origin) || vercelPreview.test(origin)) {
        return cb(null, true);
      }

      // IMPORTANT: do NOT throw Error here; just deny
      return cb(null, false);
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],

    // helps caching preflight
    maxAge: 86400,
  });

  await app.register(sensible);

  await app.register(cookie, {
    secret: config.JWT_SECRET,
    hook: "onRequest",
  });

  await app.register(jwtPlugin);
  await app.register(authGuardPlugin);

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(petsRoutes);
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  await app.register(uploadRoutes);
  await app.register(profileRoutes);

  return app;
}
