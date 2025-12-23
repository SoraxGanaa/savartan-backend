import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: "USER" | "ADMIN" };
    user: { sub: string; role: "USER" | "ADMIN" };
  }
}
