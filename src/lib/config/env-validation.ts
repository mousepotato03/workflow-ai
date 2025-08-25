import { z } from "zod";

// Environment variable validation schema
const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "Supabase service role key is required"),

  // Google AI
  GOOGLE_API_KEY: z.string().min(1, "Google AI API key is required"),

  // Optional OpenAI
  OPENAI_API_KEY: z.string().optional(),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Log level for debugging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let validatedEnv: EnvConfig | null = null;

/**
 * Validate and get environment variables
 * Throws error if validation fails
 */
export function getValidatedEnv(): EnvConfig {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      );
      throw new Error(
        `Environment validation failed:\n${errorMessages.join("\n")}`
      );
    }
    throw error;
  }
}

/**
 * Check if all required environment variables are present
 */
export function validateEnvironment(): boolean {
  try {
    getValidatedEnv();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get environment variable with validation
 */
export function getEnvVar(key: keyof EnvConfig): string {
  const env = getValidatedEnv();
  const value = env[key];

  if (!value && key !== "OPENAI_API_KEY") {
    throw new Error(`Required environment variable ${key} is not set`);
  }

  return value || "";
}

/**
 * Mask sensitive environment variables for logging
 */
export function getMaskedEnvForLogging() {
  try {
    const env = getValidatedEnv();
    return {
      NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: `${env.SUPABASE_SERVICE_ROLE_KEY.slice(
        0,
        10
      )}...`,
      GOOGLE_API_KEY: `${env.GOOGLE_API_KEY.slice(0, 10)}...`,
      OPENAI_API_KEY: env.OPENAI_API_KEY
        ? `${env.OPENAI_API_KEY.slice(0, 10)}...`
        : "not set",
      NODE_ENV: env.NODE_ENV,
    };
  } catch {
    return { error: "Environment validation failed" };
  }
}
