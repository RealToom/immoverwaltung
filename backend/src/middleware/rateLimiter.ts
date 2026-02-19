import rateLimit from "express-rate-limit";

// Strikter Limiter fuer Auth-Endpunkte (Brute-Force-Schutz)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Zu viele Anfragen. Bitte versuchen Sie es in 15 Minuten erneut.",
  },
});

// Allgemeiner Limiter fuer alle API-Routen (DoS-Schutz)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.",
  },
  // Upload-Routen haben ihr eigenes Limit (multer begrenzt Dateigröße)
  skip: (req) => req.method === "GET",
});
