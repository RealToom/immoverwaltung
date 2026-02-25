import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // Strukturiertes JSON-Logging (Standard fuer Production und Log-Systeme)
  // Fuer lesbare Dev-Ausgabe: npm install -D pino-pretty && LOG_LEVEL=debug npx pino-pretty
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Automatische PII-Redaktion sensibler Felder (DSGVO-Konformität)
  redact: {
    paths: [
      "*.password",
      "*.passwordHash",
      "*.encryptedPassword",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.secret",
      "*.apiKey",
      "*.api_key",
      "*.iban",
      "*.IBAN",
    ],
    censor: "[REDACTED]",
  },
});
