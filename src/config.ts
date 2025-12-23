import "dotenv/config";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  PORT: Number(process.env.PORT ?? 3001),

  DB_HOST: must("DB_HOST"),
  DB_PORT: Number(process.env.DB_PORT ?? 5432),
  DB_NAME: must("DB_NAME"),
  DB_USER: must("DB_USER"),
  DB_PASSWORD: must("DB_PASSWORD"),

  JWT_SECRET: must("JWT_SECRET"),

  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_DAYS: Number(process.env.REFRESH_TOKEN_DAYS ?? 30),

  NODE_ENV: process.env.NODE_ENV ?? "development",

  AWS_REGION: must("AWS_REGION"),
  AWS_ACCESS_KEY_ID: must("AWS_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: must("AWS_SECRET_ACCESS_KEY"),
  AWS_S3_BUCKET: must("AWS_S3_BUCKET")
};

export const isProd = config.NODE_ENV === "production";
