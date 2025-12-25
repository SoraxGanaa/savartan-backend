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
    if (!origin) return cb(null, true);

    const allowed = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://savartan-frontend.vercel.app",
    ];

    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
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
