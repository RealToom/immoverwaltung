import type { CorsOptions } from "cors";

const DEV_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigins(): string[] | "*" {
  const env = process.env.CORS_ORIGINS;
  if (!env) return DEV_ORIGINS;
  if (env.trim() === "*") return "*";
  return env.split(",").map((o) => o.trim()).filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

export const corsOptions: CorsOptions = {
  origin: allowedOrigins === "*" ? "*" : allowedOrigins,
  credentials: allowedOrigins !== "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
