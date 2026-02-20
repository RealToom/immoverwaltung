import type { CorsOptions } from "cors";

const DEV_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigins(): string[] {
  const env = process.env.CORS_ORIGINS;
  const isProd = process.env.NODE_ENV === "production";

  if (!env) {
    if (isProd) {
      throw new Error(
        "CORS_ORIGINS muss in Production explizit gesetzt werden (komma-separierte Liste von Origins)"
      );
    }
    return DEV_ORIGINS;
  }

  // Wildcard niemals in Production erlauben
  if (env.trim() === "*") {
    if (isProd) {
      throw new Error("Wildcard CORS_ORIGINS='*' ist in Production nicht erlaubt");
    }
    return DEV_ORIGINS;
  }

  return env.split(",").map((o) => o.trim()).filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

export const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};
