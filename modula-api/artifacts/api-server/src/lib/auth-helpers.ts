import { type Request } from "express";
import { createHash } from "crypto";
import { getAuth } from "@clerk/express";
import { eq, and } from "drizzle-orm";
import {
  db,
  usersTable,
  patientsTable,
  doctorsTable,
  patientDoctorsTable,
  patientClinicsTable,
  clinicOwnersTable,
  secretariesTable,
} from "@workspace/db";
import { verifyAccessToken } from "./jwt";

export type UserRole = "patient" | "profissional_saude" | "clinic_owner" | "super_admin" | "secretaria";

export type AuthenticatedUser = typeof usersTable.$inferSelect;

export type AuthenticationResult =
  | {
      authenticated: true;
      user: AuthenticatedUser;
      clinicId?: number;
      strategy: "local_jwt" | "legacy_token" | "clerk";
    }
  | {
      authenticated: false;
      reason:
        | "missing_credentials"
        | "invalid_token"
        | "expired_token"
        | "user_disabled"
        | "clerk_unavailable"
        | "clerk_user_not_found";
    };

function readBearerToken(req: Request, allowQueryToken: boolean): string | undefined {
  const header = req.headers.authorization;
  const queryToken = allowQueryToken && typeof req.query.token === "string" ? req.query.token : undefined;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  return bearerToken ?? queryToken;
}

async function authenticateWithClerk(req: Request): Promise<AuthenticationResult> {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return { authenticated: false, reason: "missing_credentials" };
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, auth.userId))
      .limit(1);

    if (users.length === 0) {
      return { authenticated: false, reason: "clerk_user_not_found" };
    }

    if (users[0].deactivatedAt !== null) {
      return { authenticated: false, reason: "user_disabled" };
    }

    return { authenticated: true, user: users[0], strategy: "clerk" };
  } catch {
    return { authenticated: false, reason: "clerk_unavailable" };
  }
}

export async function authenticateRequest(
  req: Request,
  options: { allowQueryToken?: boolean } = {}
): Promise<AuthenticationResult> {
  const token = readBearerToken(req, options.allowQueryToken ?? false);

  if (token) {
    const jwtPayload = await verifyAccessToken(token);
    if (jwtPayload) {
      const userId = parseInt(jwtPayload.sub, 10);
      if (isNaN(userId)) {
        return { authenticated: false, reason: "invalid_token" };
      }
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      if (users.length === 0) {
        return { authenticated: false, reason: "invalid_token" };
      }
      if (users[0].deactivatedAt !== null) {
        return { authenticated: false, reason: "user_disabled" };
      }
      const clinicId = typeof jwtPayload.clinicId === "number" ? jwtPayload.clinicId : undefined;
      if (clinicId !== undefined) {
        (req as Request & { clinicId?: number }).clinicId = clinicId;
      }
      return { authenticated: true, user: users[0], clinicId, strategy: "local_jwt" };
    }

    const looksLikeJwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
    if (looksLikeJwt) {
      return { authenticated: false, reason: "expired_token" };
    }

    if (token.startsWith(ACCESS_TOKEN_PREFIX)) {
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.accessToken, hashAccessToken(token)))
        .limit(1);
      if (users.length === 0) {
        return { authenticated: false, reason: "invalid_token" };
      }
      if (users[0].deactivatedAt !== null) {
        return { authenticated: false, reason: "user_disabled" };
      }
      return { authenticated: true, user: users[0], strategy: "legacy_token" };
    }
  }

  return authenticateWithClerk(req);
}

/**
 * Ensure the current user may access a patient's data.
 *
 * - patient: own data only.
 * - profissional_saude: must be assigned to the patient; if a clinic-scoped JWT
 *   is present, the patient must also be enrolled in that clinic.
 * - clinic_owner: ALWAYS resolves their effective clinic (JWT claim → DB lookup)
 *   and verifies the patient is enrolled in it. No clinic linked = deny.
 *
 * Returns the patient record if authorized, otherwise null.
 */
export async function ensurePatientAccess(
  user: { id: number; role: UserRole },
  patientId: number,
  clinicId?: number
) {
  const patientRows = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);
  if (patientRows.length === 0) return null;
  const patient = patientRows[0];

  if (user.role === "patient") {
    return patient.userId === user.id ? patient : null;
  }

  if (user.role === "clinic_owner") {
    // Always derive the effective clinic — JWT claim takes priority, then DB lookup.
    const effectiveClinicId = await resolveOwnerClinicId(user.id, clinicId);
    if (effectiveClinicId === undefined) return null; // owner has no clinic linked
    const enrollment = await db
      .select()
      .from(patientClinicsTable)
      .where(
        and(
          eq(patientClinicsTable.patientId, patient.id),
          eq(patientClinicsTable.clinicId, effectiveClinicId)
        )
      )
      .limit(1);
    return enrollment.length > 0 ? patient : null;
  }

  if (user.role === "profissional_saude") {
    const doctorRows = await db
      .select()
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    if (doctorRows.length === 0) return null;
    const myDoctorId = doctorRows[0].id;
    const myClinicId = doctorRows[0].clinicId;
    const link = await db
      .select()
      .from(patientDoctorsTable)
      .where(
        and(
          eq(patientDoctorsTable.patientId, patient.id),
          eq(patientDoctorsTable.doctorId, myDoctorId)
        )
      )
      .limit(1);
    if (link.length === 0) return null;
    // Always verify the patient is enrolled in the doctor's own clinic — fail-closed.
    const enrollment = await db
      .select()
      .from(patientClinicsTable)
      .where(
        and(
          eq(patientClinicsTable.patientId, patient.id),
          eq(patientClinicsTable.clinicId, myClinicId)
        )
      )
      .limit(1);
    return enrollment.length > 0 ? patient : null;
  }

  if (user.role === "secretaria") {
    // Secretaries can access any patient enrolled in their own clinic.
    const mySecretaryClinicId = await resolveSecretaryClinicId(user.id, clinicId);
    if (mySecretaryClinicId === undefined) return null;
    const enrollment = await db
      .select()
      .from(patientClinicsTable)
      .where(
        and(
          eq(patientClinicsTable.patientId, patient.id),
          eq(patientClinicsTable.clinicId, mySecretaryClinicId)
        )
      )
      .limit(1);
    return enrollment.length > 0 ? patient : null;
  }

  return null;
}

/**
 * Resolve the effective clinic ID for a secretaria.
 * Uses the JWT claim if present; otherwise looks up the secretaries table.
 * Returns undefined if the user has no secretary record / no clinic linked.
 */
export async function resolveSecretaryClinicId(
  userId: number,
  jwtClinicId?: number
): Promise<number | undefined> {
  if (jwtClinicId !== undefined) return jwtClinicId;
  const row = await db
    .select({ clinicId: secretariesTable.clinicId })
    .from(secretariesTable)
    .where(eq(secretariesTable.userId, userId))
    .limit(1);
  return row[0]?.clinicId;
}

/**
 * Verify a patient is enrolled in the given clinic.
 * Returns the patient record if enrolled, otherwise null.
 */
export async function ensureClinicAccess(
  patientId: number,
  clinicId: number
): Promise<typeof patientsTable.$inferSelect | null> {
  const patientRows = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId))
    .limit(1);
  if (patientRows.length === 0) return null;

  const enrollment = await db
    .select()
    .from(patientClinicsTable)
    .where(
      and(
        eq(patientClinicsTable.patientId, patientId),
        eq(patientClinicsTable.clinicId, clinicId)
      )
    )
    .limit(1);

  return enrollment.length > 0 ? patientRows[0] : null;
}

/**
 * Resolve the effective clinic ID for a clinic_owner.
 * Uses the JWT claim if present; otherwise looks up the clinic_owners table.
 * Returns undefined if no clinic is linked.
 */
export async function resolveOwnerClinicId(
  userId: number,
  jwtClinicId?: number
): Promise<number | undefined> {
  if (jwtClinicId !== undefined) return jwtClinicId;
  const row = await db
    .select({ clinicId: clinicOwnersTable.clinicId })
    .from(clinicOwnersTable)
    .where(eq(clinicOwnersTable.userId, userId))
    .limit(1);
  return row[0]?.clinicId;
}

/**
 * Resolve the effective clinic ID for any staff caller (clinic_owner,
 * profissional_saude, secretaria). This is the single source of truth for
 * "which clinic is this staff member acting within right now" — used both
 * to scope queries and to stamp audit records (e.g. staff_events) with the
 * correct clinic. Never derive a staff event's clinic from patient-side
 * data alone (a patient may be enrolled in multiple clinics); always use
 * the caller's own effective clinic.
 * Returns null if the caller has no role-appropriate clinic link.
 */
export async function resolveCallerClinicId(
  user: { id: number; role: string },
  jwtClinicId?: number
): Promise<number | null> {
  if (user.role === "clinic_owner") {
    return (await resolveOwnerClinicId(user.id, jwtClinicId)) ?? null;
  }
  if (user.role === "profissional_saude") {
    const [myDoc] = await db
      .select({ clinicId: doctorsTable.clinicId })
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    return myDoc?.clinicId ?? null;
  }
  if (user.role === "secretaria") {
    return (await resolveSecretaryClinicId(user.id, jwtClinicId)) ?? null;
  }
  return null;
}

export const ACCESS_TOKEN_PREFIX = "clinic_pat_";

// Tokens are high-entropy (24 random bytes), so a plain SHA-256 is sufficient —
// only the hash is persisted; the raw token is shown once at generation time.
export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requireAuth(
  req: Request,
  options: { allowQueryToken?: boolean } = {}
): Promise<{ user: typeof usersTable.$inferSelect; clinicId?: number } | { error: string; status: number }> {
  const authResult = await authenticateRequest(req, options);
  if (authResult.authenticated) {
    return { user: authResult.user, clinicId: authResult.clinicId };
  }

  if (authResult.reason === "missing_credentials" || authResult.reason === "clerk_unavailable") {
    return { error: "Unauthorized", status: 401 };
  }
  if (authResult.reason === "clerk_user_not_found") {
    return { error: "User profile not found", status: 404 };
  }
  if (authResult.reason === "user_disabled") {
    return { error: "Account deactivated", status: 401 };
  }
  if (authResult.reason === "expired_token") {
    return { error: "Sessão expirada, faça login novamente", status: 401 };
  }
  return { error: "Unauthorized", status: 401 };
}

export function isError(
  result: { user: typeof usersTable.$inferSelect; clinicId?: number } | { error: string; status: number }
): result is { error: string; status: number } {
  return "error" in result;
}
