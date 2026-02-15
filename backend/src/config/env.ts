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
};
