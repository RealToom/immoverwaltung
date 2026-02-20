import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger.js";
import { corsOptions } from "./config/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

const app = express();

// Security headers
app.use(helmet({
  // HSTS: Browser merkt sich 1 Jahr lang, nur HTTPS zu nutzen
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // Kein Referrer-Leakage beim Klick auf externe Links
  referrerPolicy: { policy: "no-referrer" },
}));
app.set("trust proxy", 1); // Trust first proxy (Docker/Nginx)

// Strukturiertes Request-Logging via Pino
app.use(pinoHttp({
  logger,
  // Health-Check Requests nicht loggen (zu viel Noise)
  autoLogging: { ignore: (req) => req.url === "/health" },
  customLogLevel(_req, res) {
    if (res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
}));

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

// Health check (inkl. DB-Verbindungsstatus) — kein Timestamp (verhindert Timing-Analyse)
app.get("/health", async (_req, res) => {
  try {
    const { prisma } = await import("./lib/prisma.js");
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "ok" });
  } catch {
    res.status(503).json({ status: "error", db: "unavailable" });
  }
});

// API routes
app.use("/api", apiRouter);

// Error handler (must be last)
app.use(errorHandler);

export { app };
