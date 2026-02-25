function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt`);
  }
  return value;
}

export const env = {
  get DATABASE_URL() { return requireEnv("DATABASE_URL"); },
  get JWT_ACCESS_SECRET() { return requireEnv("JWT_ACCESS_SECRET"); },
  get JWT_REFRESH_SECRET() { return requireEnv("JWT_REFRESH_SECRET"); },
  get PORT() { return parseInt(process.env.PORT || "3001", 10); },
  get NODE_ENV() { return process.env.NODE_ENV || "development"; },
  get isDev() { return this.NODE_ENV === "development"; },
  get UPLOAD_DIR() { return process.env.UPLOAD_DIR || "./uploads"; },
  get SMTP_HOST() { return process.env.SMTP_HOST || ""; },
  get SMTP_PORT() { return parseInt(process.env.SMTP_PORT || "587", 10); },
  get SMTP_USER() { return process.env.SMTP_USER || ""; },
  get SMTP_PASS() { return process.env.SMTP_PASS || ""; },
  get SMTP_FROM() { return process.env.SMTP_FROM || "noreply@immoverwalt.de"; },
  get ENCRYPTION_KEY() { return process.env.ENCRYPTION_KEY || ""; },  // 32-byte hex for AES-256 (DSGVO Art. 32)
  // Bcrypt cost factor: 12+ empfohlen (OWASP 2026), konfigurierbar für künftige Hardware
  get BCRYPT_COST() {
    const cost = parseInt(process.env.BCRYPT_COST || "12", 10);
    if (cost < 10 || cost > 15) throw new Error("BCRYPT_COST muss zwischen 10 und 15 liegen");
    return cost;
  },
  // Anthropic API Key für KI-Belegscan (optional — Feature deaktiviert wenn nicht gesetzt)
  get ANTHROPIC_API_KEY() { return process.env.ANTHROPIC_API_KEY || ""; },
  get NORDIGEN_SECRET_ID() { return process.env.NORDIGEN_SECRET_ID || ""; },
  get NORDIGEN_SECRET_KEY() { return process.env.NORDIGEN_SECRET_KEY || ""; },
  // Base URL for Nordigen OAuth callback redirect (no trailing slash)
  get NORDIGEN_REDIRECT_BASE() { return process.env.NORDIGEN_REDIRECT_BASE || "http://localhost:8080"; },
};
