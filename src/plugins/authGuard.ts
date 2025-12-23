import fp from "fastify-plugin";

export const authGuardPlugin = fp(async (app) => {
  app.decorate("auth", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.unauthorized("Invalid or missing access token");
    }
  });
});
