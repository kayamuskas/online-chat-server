/**
 * Shared runtime configuration contracts.
 *
 * Service ports and the RuntimeEnv interface are defined here so that the API,
 * worker, and web apps all share the same configuration expectations instead of
 * defining their own ad-hoc constants.
 */

export const SERVICE_PORTS = {
  apiHttp: 3000,
  webHttp: 4173,
  redis: 6379,
  postgres: 5432,
} as const;

export interface RuntimeEnv {
  NODE_ENV: "development" | "production" | "test";
  API_PORT: number;
  WEB_PORT: number;
  ALLOWED_ORIGIN: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string | undefined;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  SMTP_HOST: string | undefined;
  SMTP_PORT: number | undefined;
  SMTP_USER: string | undefined;
  SMTP_PASS: string | undefined;
  SMTP_FROM: string | undefined;
}

/**
 * Parse and validate runtime environment variables, applying defaults where
 * appropriate. Throws on any missing required field so startup fails fast
 * rather than producing undefined behaviour at runtime.
 */
export function parseRuntimeEnv(raw: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  const requiredStrings: Array<keyof RuntimeEnv> = [
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
  ];

  const missing = requiredStrings.filter((k) => !raw[k as string]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const nodeEnv = (raw["NODE_ENV"] ?? "development") as RuntimeEnv["NODE_ENV"];
  if (!["development", "production", "test"].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV value: "${nodeEnv}"`);
  }

  const smtpPort = raw["SMTP_PORT"] ? parseInt(raw["SMTP_PORT"], 10) : undefined;

  return {
    NODE_ENV: nodeEnv,
    API_PORT: parseInt(raw["API_PORT"] ?? String(SERVICE_PORTS.apiHttp), 10),
    WEB_PORT: parseInt(raw["WEB_PORT"] ?? String(SERVICE_PORTS.webHttp), 10),
    ALLOWED_ORIGIN:
      raw["ALLOWED_ORIGIN"] ?? "http://localhost:4173,http://127.0.0.1:4173",
    REDIS_HOST: raw["REDIS_HOST"] ?? "localhost",
    REDIS_PORT: parseInt(raw["REDIS_PORT"] ?? String(SERVICE_PORTS.redis), 10),
    REDIS_PASSWORD: raw["REDIS_PASSWORD"] || undefined,
    POSTGRES_HOST: raw["POSTGRES_HOST"] ?? "localhost",
    POSTGRES_PORT: parseInt(
      raw["POSTGRES_PORT"] ?? String(SERVICE_PORTS.postgres),
      10,
    ),
    POSTGRES_DB: raw["POSTGRES_DB"] as string,
    POSTGRES_USER: raw["POSTGRES_USER"] as string,
    POSTGRES_PASSWORD: raw["POSTGRES_PASSWORD"] as string,
    SMTP_HOST: raw["SMTP_HOST"] || undefined,
    SMTP_PORT: smtpPort,
    SMTP_USER: raw["SMTP_USER"] || undefined,
    SMTP_PASS: raw["SMTP_PASS"] || undefined,
    SMTP_FROM: raw["SMTP_FROM"] || undefined,
  };
}
