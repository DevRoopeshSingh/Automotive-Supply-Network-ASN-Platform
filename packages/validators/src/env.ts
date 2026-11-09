import { z } from "zod";

export const BackendEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z
      .string()
      .url("DATABASE_URL must be a valid PostgreSQL connection string"),
    REDIS_URL: z
      .string()
      .url("REDIS_URL must be a valid Redis connection string"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    CORS_ORIGIN: z.string().default("*"),
    ALLOW_DEV_OTP: z.enum(["true", "false"]).default("false"),
  })
  .refine(
    (data) => {
      // Dev OTP bypass must NEVER be enabled in production
      if (data.NODE_ENV === "production" && data.ALLOW_DEV_OTP === "true") {
        return false;
      }
      return true;
    },
    {
      message:
        "CRITICAL SECURITY CONFIGURATION ERROR: ALLOW_DEV_OTP cannot be set to 'true' when NODE_ENV is 'production'",
      path: ["ALLOW_DEV_OTP"],
    },
  )
  .refine(
    (data) => {
      // Insecure default secrets must NEVER be used in production
      if (data.NODE_ENV === "production") {
        const insecureDefaults = [
          "asn_super_secret_jwt_key_with_at_least_32_characters_long",
          "asn_super_secret_refresh_jwt_key_with_at_least_32_chars",
        ];
        if (
          insecureDefaults.includes(data.JWT_SECRET) ||
          insecureDefaults.includes(data.JWT_REFRESH_SECRET)
        ) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        "CRITICAL SECURITY CONFIGURATION ERROR: Insecure default development JWT secrets cannot be used in production",
      path: ["JWT_SECRET"],
    },
  );

export const FrontendEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Automotive Supply Network"),
});

export type BackendEnv = z.infer<typeof BackendEnvSchema>;
export type FrontendEnv = z.infer<typeof FrontendEnvSchema>;
