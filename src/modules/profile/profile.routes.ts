import { FastifyInstance } from "fastify";
import { getMyProfile, updateMyProfile } from "./profile.service";

export async function profileRoutes(app: FastifyInstance) {
  app.get("/profile", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) return reply.unauthorized("Missing user");
    const data = await getMyProfile(userId);
    if (!data) return reply.notFound("User not found");
    return data;
  });

  app.patch("/profile", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) return reply.unauthorized("Missing user");

    const body = (req.body ?? {}) as any;

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const phone_number =
      typeof body.phone_number === "string" ? body.phone_number.trim() : undefined;
    const location = typeof body.location === "string" ? body.location.trim() : undefined;

    return updateMyProfile({ userId, name, phone_number, location });
  });
}
