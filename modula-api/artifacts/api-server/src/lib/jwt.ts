import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createHash, randomBytes } from "crypto";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-change-me"
);

const ISSUER = "clinicainbox";
const LEGACY_ISSUER = "omniclinic";
const LEGACY_ISSUER2 = "clinica-emagrecer";
const LEGACY_ISSUER3 = "clinictare";
const AUDIENCE = "api";

export interface ClinicJwtPayload extends JWTPayload {
  sub: string; // user id
  email: string;
  role: string;
  clinicId?: number; // set only on clinic-scoped tokens
}

export async function signAccessToken(userId: number, email: string, role: string): Promise<string> {
  return new SignJWT({ sub: String(userId), email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("1h")
    .sign(SECRET);
}

export async function signClinicScopedToken(userId: number, email: string, role: string, clinicId: number): Promise<string> {
  return new SignJWT({ sub: String(userId), email, role, clinicId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("1h")
    .sign(SECRET);
}

export async function verifyAccessToken(token: string): Promise<ClinicJwtPayload | null> {
  for (const issuer of [ISSUER, LEGACY_ISSUER, LEGACY_ISSUER2, LEGACY_ISSUER3]) {
    try {
      const { payload } = await jwtVerify(token, SECRET, {
        issuer,
        audience: AUDIENCE,
        clockTolerance: 60,
      });
      if (!payload.sub || !payload.email || !payload.role) return null;
      return payload as ClinicJwtPayload;
    } catch {
      // try next issuer
    }
  }
  return null;
}

// ── Refresh tokens ──────────────────────────────────────────────────────────

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Use bcryptjs for password hashing
export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(plain, hash);
}
