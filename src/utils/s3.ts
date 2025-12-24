import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
 
    const key = u.pathname.replace(/^\/+/, "");
    if (!key) return null;

    const host = u.host.toLowerCase();
    const bucketHost1 = `${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com`.toLowerCase();
    const bucketHost2 = `${config.AWS_S3_BUCKET}.s3.amazonaws.com`.toLowerCase();

    if (host !== bucketHost1 && host !== bucketHost2) return null;

    return key;
  } catch {
    return null;
  }
}

export async function deleteFromS3ByKey(key: string) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.AWS_S3_BUCKET,
      Key: key
    })
  );
}

export async function deleteManyFromS3ByUrls(urls: string[]) {
  const keys = urls
    .map(extractS3KeyFromUrl)
    .filter((k): k is string => !!k);

  await Promise.allSettled(keys.map((k) => deleteFromS3ByKey(k)));
}
