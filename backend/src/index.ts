import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import { startRetentionCleanup, stopRetentionCleanup } from "./services/retention.service.js";

const port = env.PORT;

// Unhandled rejections/exceptions -> loggen und sauber beenden
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unbehandelter Promise-Rejection");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Unbehandelter Fehler");
  process.exit(1);
});

async function main(): Promise<void> {
  // Fail fast wenn DB nicht erreichbar
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info("Datenbankverbindung OK");
  } catch (err) {
    logger.error({ err }, "Datenbankverbindung fehlgeschlagen - Server startet nicht");
    process.exit(1);
  }

  const server = app.listen(port, () => {
    logger.info({ port, env: env.NODE_ENV }, "Server gestartet");
    startRetentionCleanup();
  });

  // Graceful Shutdown: laufende Requests abwarten, dann DB trennen
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, "Fahre Server herunter...");
    stopRetentionCleanup();
    server.close(async () => {
      logger.info("HTTP-Server geschlossen");
      await prisma.$disconnect();
      logger.info("Datenbankverbindung getrennt");
      process.exit(0);
    });

    // Erzwungener Exit nach 10s falls Requests haengen
    setTimeout(() => {
      logger.error("Erzwungener Shutdown nach Timeout");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
