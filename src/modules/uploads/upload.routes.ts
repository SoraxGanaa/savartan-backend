import { FastifyInstance } from "fastify";
import { uploadToS3 } from "../../utils/s3";

export async function uploadRoutes(app: FastifyInstance) {
  app.post(
    "/uploads",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const file = await req.file();

      if (!file) {
        return reply.badRequest("File is required");
      }

      const buffer = await file.toBuffer();

      const uploaded = await uploadToS3({
        buffer,
        contentType: file.mimetype,
        folder: "pets"
      });

      return {
        url: uploaded.url,
        key: uploaded.key,
        media_type: file.mimetype.startsWith("video") ? "VIDEO" : "IMAGE"
      };
    }
  );
}
