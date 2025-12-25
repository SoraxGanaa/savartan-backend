import { FastifyInstance } from "fastify";
import {
  addOrReplaceMediaBodySchema,
  createPetBodySchema,
  updatePetBodySchema,
} from "./pets.schemas";
import {
  assertCanEditOrThrow,
  createPetWithMedia,
  deletePetHard,
  getPetById,
  listPets,
  replacePetMedia,
  updatePet,
} from "./pets.service";

function parseBool(v: any): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === "true" || v === true) return true;
  if (v === "false" || v === false) return false;
  return undefined;
}

export async function petsRoutes(app: FastifyInstance) {
  // All pets routes require auth
  const requireAuth = { preHandler: (app as any).auth };

  // CREATE pet + media (combined)
  app.post(
    "/pets",
    {
      ...requireAuth,
      schema: { body: createPetBodySchema },
    },
    async (req: any, reply) => {
      const body = req.body as any;
      const userId = req.user.sub as string;

      const created = await createPetWithMedia({
        createdBy: userId,
        input: {
          ...body,
          media: body.media ?? null,
        },
      });

      return reply.code(201).send(created);
    }
  );

  app.get("/pets", { ...requireAuth }, async (req: any) => {
    const q = req.query as any;

    return listPets({
      type: q.type,
      category: q.category,
      sex: q.sex,
      location: q.location,
      is_active: parseBool(q.is_active),
      sprayed: parseBool(q.sprayed),
      vaccinated: parseBool(q.vaccinated),
      dewormed: parseBool(q.dewormed),
      created_by: q.created_by,
      search: q.search,
      min_age: q.min_age !== undefined ? Number(q.min_age) : undefined,
      max_age: q.max_age !== undefined ? Number(q.max_age) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
  });

  app.get("/pets/:id", { ...requireAuth }, async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const data = await getPetById(id);
    if (!data) return reply.notFound("Pet not found");
    return data;
  });

  // UPDATE pet
  app.patch(
    "/pets/:id",
    {
      ...requireAuth,
      schema: { body: updatePetBodySchema },
    },
    async (req: any, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as any;

      await assertCanEditOrThrow({
        petId: id,
        userId: req.user.sub,
        role: req.user.role,
      });

      const updated = await updatePet(id, body);
      if (!updated) return reply.notFound("Pet not found");
      return { pet: updated };
    }
  );

  // REPLACE media (simple, consistent)
  app.put(
    "/pets/:id/media",
    {
      ...requireAuth,
      schema: { body: addOrReplaceMediaBodySchema },
    },
    async (req: any, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as any;

      await assertCanEditOrThrow({
        petId: id,
        userId: req.user.sub,
        role: req.user.role,
      });

      // ensure pet exists
      const existing = await getPetById(id);
      if (!existing) return reply.notFound("Pet not found");

      const media = await replacePetMedia(id, body.media);
      return { pet: existing.pet, media };
    }
  );

  // DELETE pet (hard delete)
  app.delete("/pets/:id", { ...requireAuth }, async (req: any, reply) => {
    const { id } = req.params as { id: string };

    await assertCanEditOrThrow({
      petId: id,
      userId: req.user.sub,
      role: req.user.role,
    });

    const deleted = await deletePetHard(id);
    if (!deleted) return reply.notFound("Pet not found");

    return { ok: true, id: deleted.id };
  });
}
