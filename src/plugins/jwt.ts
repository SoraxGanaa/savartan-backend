import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { config } from "../config";

export const jwtPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: config.JWT_SECRET
  });
});
