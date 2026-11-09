import * as dotenv from "dotenv";
import { BackendEnvSchema, type BackendEnv } from "@asn/validators";

dotenv.config();

function loadConfig(): BackendEnv {
  const result = BackendEnvSchema.safeParse({
    NODE_ENV: process.env["NODE_ENV"] || "development",
    PORT: process.env["PORT"] || 4000,
    DATABASE_URL:
      process.env["DATABASE_URL"] ||
      "postgresql://asn_user:asn_password@localhost:5432/asn_dev?schema=public",
    REDIS_URL: process.env["REDIS_URL"] || "redis://localhost:6379",
    JWT_SECRET:
      process.env["JWT_SECRET"] ||
      "asn_super_secret_jwt_key_with_at_least_32_characters_long",
    JWT_REFRESH_SECRET:
      process.env["JWT_REFRESH_SECRET"] ||
      "asn_super_secret_refresh_jwt_key_with_at_least_32_chars",
    CORS_ORIGIN: process.env["CORS_ORIGIN"] || "*",
    ALLOW_DEV_OTP: (process.env["ALLOW_DEV_OTP"] || "false").toLowerCase(),
  });

  if (!result.success) {
    console.error(
      "❌ Invalid backend environment configuration:",
      result.error.format(),
    );
    throw new Error("Invalid backend environment configuration");
  }

  return result.data;
}

export const envConfig = loadConfig();
