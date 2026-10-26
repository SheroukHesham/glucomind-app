function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Signs access tokens. Set it in services/user-service/.env (never commit it). */
export const JWT_SECRET = requireEnv("JWT_SECRET");
export const JWT_EXPIRES_IN = "1h";
