// Wird vor allen Tests geladen (vitest.config.ts -> setupFiles)
// Env-Vars muessen VOR dem ersten Modul-Import gesetzt sein
process.env.JWT_ACCESS_SECRET = "test-access-secret-min-32-zeichen-lang!!";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-min-32-zeichen-lang!!";
process.env.ENCRYPTION_KEY = "a".repeat(64);
process.env.NODE_ENV = "test";
