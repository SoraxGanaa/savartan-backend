import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { config } from "../config";

export const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY
  }
});

export async function uploadToS3(params: {
  buffer: Buffer;
  contentType: string;
  folder: "pets";
}) {
  const key = `${params.folder}/${randomUUID()}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType
      // ✅ NO ACL HERE
    })
  );

  return {
    key,
    url: `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`
  };
}
