import { FastifyInstance } from "fastify";
import { config } from "../../config";
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from "../../utils/cookies";
import { accessTokenResponseSchema, loginBodySchema, registerBodySchema } from "./auth.schemas";
import { createUser, issueRefreshToken, revokeRefreshToken, rotateRefreshToken, validateLogin } from "./auth.service";

export async function authRoutes(app: FastifyInstance) {
  // REGISTER
  app.post(
    "/auth/register",
    { schema: { body: registerBodySchema } },
    async (req, reply) => {
      const body = req.body as any;

      try {
        const user = await createUser({
          name: body.name,
          phone_number: body.phone_number,
          email: body.email ?? null,
          password: body.password,
          age: body.age ?? null,
          sex: body.sex ?? null,
          location: body.location ?? null
        });

        return reply.code(201).send({ user });
      } catch (e: any) {
        if (e?.code === "23505") return reply.conflict("Phone number or email already exists");
        throw e;
      }
    }
  );

  // LOGIN
  app.post(
    "/auth/login",
    { schema: { body: loginBodySchema, response: { 200: accessTokenResponseSchema } } },
    async (req, reply) => {
      const body = req.body as any;

      const result = await validateLogin(body.phone_number, body.password);
      if (!result.ok) return reply.unauthorized(result.reason);

      const { id, role } = result.user;

      const accessToken = await reply.jwtSign(
        { sub: id, role },
        { expiresIn: config.ACCESS_TOKEN_TTL }
      );

      const refresh = await issueRefreshToken({
        userId: id,
        userAgent: req.headers["user-agent"] as string | undefined,
        ip: req.ip
      });

      reply.setCookie(REFRESH_COOKIE_NAME, refresh.token, {
        ...refreshCookieOptions(),
        expires: refresh.expiresAt
      });

      return reply.send({ accessToken });
    }
  );

  // REFRESH (rotate)
  app.post(
    "/auth/refresh",
    { schema: { response: { 200: accessTokenResponseSchema } } },
    async (req, reply) => {
      const refreshToken = (req.cookies as any)?.[REFRESH_COOKIE_NAME];
      if (!refreshToken) return reply.unauthorized("Missing refresh token");

      const rotated = await rotateRefreshToken({
        refreshToken,
        userAgent: req.headers["user-agent"] as string | undefined,
        ip: req.ip
      });

      if (!rotated.ok) return reply.unauthorized(rotated.reason);

      const { id, role } = rotated.user;

      const accessToken = await reply.jwtSign(
        { sub: id, role },
        { expiresIn: config.ACCESS_TOKEN_TTL }
      );

      reply.setCookie(REFRESH_COOKIE_NAME, rotated.newRefresh.token, {
        ...refreshCookieOptions(),
        expires: rotated.newRefresh.expiresAt
      });

      return reply.send({ accessToken });
    }
  );

  // LOGOUT
  app.post("/auth/logout", async (req, reply) => {
    const refreshToken = (req.cookies as any)?.[REFRESH_COOKIE_NAME];
    if (refreshToken) await revokeRefreshToken(refreshToken);

    reply.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    return reply.send({ ok: true });
  });

  // protected example
  app.get("/me", { preHandler: (app as any).auth }, async (req: any) => {
    return { user: req.user };
  });
}
