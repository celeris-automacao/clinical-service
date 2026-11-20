import { Router } from "express";
import { eq, and, isNull, isNotNull, or, lt, gte, count, sql } from "drizzle-orm";
import { db, usersTable, patientsTable, doctorsTable, staffEventsTable, clinicSettingsTable, passwordResetTokensTable, patientClinicsTable, clinicsTable, clinicOwnersTable, PLAN_LABELS, refreshTokensTable, requestAccessAttemptsTable } from "@workspace/db";
import { CompleteProfileBody, LoginBody, ChangePasswordBody, RegisterBody } from "@workspace/api-zod";
import { requireAuth, isError, resolveOwnerClinicId, authenticateRequest } from "../lib/auth-helpers";
import { signAccessToken, signClinicScopedToken, hashPassword, verifyPassword } from "../lib/jwt";
import { logger } from "../lib/logger";
import { sendTempPasswordEmail, sendPasswordResetEmail } from "../lib/email";
import { normalizeCpf, isValidCpf } from "../lib/cpf";
import { isClerkConfigured } from "../lib/clerkConfig";
import { z } from "zod/v4";
import crypto from "crypto";

const router = Router();

// EMAIL NORMALIZATION CONVENTION
// Every route that accepts an email address from the request body MUST normalize
// it with `.toLowerCase().trim()` before using it in any DB query or rate-limit
// bucket. This prevents case-variation bypasses (e.g. "User@example.com" vs
// "user@example.com" hitting different rows). Apply normalization immediately
// after parsing — before the first `db` call — so no code path can slip through
// with an un-normalized value.

const REQUEST_ACCESS_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_ACCESS_MAX = 3;
const REQUEST_ACCESS_IP_MAX = 10; // per-IP limit (accounts for NAT/shared IPs)

/**
 * Per-IP rate limit: returns false when a single IP has made too many
 * request-access or resend-access attempts in the last hour.  This is a
 * read-only check — the attempt row is inserted by checkRequestAccessRateLimit
 * so we don't double-count.
 */
async function checkIpRateLimit(ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - REQUEST_ACCESS_WINDOW_MS);

  const [row] = await db
    .select({ total: count() })
    .from(requestAccessAttemptsTable)
    .where(
      and(
        eq(requestAccessAttemptsTable.ip, ip),
        gte(requestAccessAttemptsTable.attemptedAt, windowStart)
      )
    );

  return (row?.total ?? 0) < REQUEST_ACCESS_IP_MAX;
}

async function checkRequestAccessRateLimit(email: string, ip: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase();
  const windowStart = new Date(Date.now() - REQUEST_ACCESS_WINDOW_MS);

  const [row] = await db
    .select({ total: count() })
    .from(requestAccessAttemptsTable)
    .where(
      and(
        eq(requestAccessAttemptsTable.email, normalizedEmail),
        gte(requestAccessAttemptsTable.attemptedAt, windowStart)
      )
    );

  if ((row?.total ?? 0) >= REQUEST_ACCESS_MAX) return false;

  await db.insert(requestAccessAttemptsTable).values({ email: normalizedEmail, ip });

  // Purge old rows for this email in the background
  db.delete(requestAccessAttemptsTable)
    .where(
      and(
        eq(requestAccessAttemptsTable.email, normalizedEmail),
        lt(requestAccessAttemptsTable.attemptedAt, windowStart)
      )
    )
    .catch((err: unknown) => logger.error({ err }, "Failed to purge old request-access attempts"));

  return true;
}

async function deleteStaleResetTokens(): Promise<void> {
  await db
    .delete(passwordResetTokensTable)
    .where(
      or(
        lt(passwordResetTokensTable.expiresAt, new Date()),
        isNotNull(passwordResetTokensTable.usedAt)
      )
    );
}

async function deleteStaleRefreshTokens(): Promise<void> {
  await db
    .delete(refreshTokensTable)
    .where(
      or(
        lt(refreshTokensTable.expiresAt, new Date()),
        isNotNull(refreshTokensTable.revokedAt)
      )
    );
}

// ── GET /auth/me ── (works with any auth method)
router.get("/auth/me", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const u = authResult.user;

  let patientId: number | null = null;
  if (u.role === "patient") {
    const [pat] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, u.id))
      .limit(1);
    patientId = pat?.id ?? null;
  }

  res.json({
    id: u.id,
    clerkId: u.clerkId ?? null,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: u.avatarUrl ?? null,
    isTemporaryPassword: u.isTemporaryPassword ?? false,
    createdAt: u.createdAt.toISOString(),
    patientId,
    cpf: u.cpf ?? null,
    rg: u.rg ?? null,
    phone: u.phone ?? null,
    birthDate: u.birthDate ?? null,
  });
});

// ── POST /auth/request-access ── (sends temporary password by email to a patient)
router.post("/auth/request-access", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

  const genericResponse = { message: "Se este e-mail estiver cadastrado, você receberá a senha em breve." };

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  // Always return 200 — do not reveal whether the email exists or not.
  // Rate limiting is only applied after a successful lookup so that mistyped
  // emails do not consume slots and leave the patient locked out.
  if (users.length === 0 || users[0].role !== "patient") {
    res.json(genericResponse);
    return;
  }

  // Per-IP limit checked first: prevents a single IP from exhausting
  // per-email quotas for patients it does not own.
  if (!await checkIpRateLimit(ip)) {
    res.status(429).json({ error: "Muitas tentativas. Aguarde 1 hora antes de tentar novamente." });
    return;
  }

  if (!await checkRequestAccessRateLimit(email, ip)) {
    res.status(429).json({ error: "Muitas tentativas. Aguarde 1 hora antes de tentar novamente." });
    return;
  }

  const user = users[0];

  // Generate a random 6-digit numeric temporary password
  const tempPassword = String(Math.floor(100000 + Math.random() * 900000));

  const passwordHash = await hashPassword(tempPassword);
  const temporaryPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await db
    .update(usersTable)
    .set({ passwordHash, isTemporaryPassword: true, temporaryPasswordExpiresAt })
    .where(eq(usersTable.id, user.id));

  try {
    const [clinicSettings] = await db.select().from(clinicSettingsTable).limit(1);
    await sendTempPasswordEmail({
      to: user.email,
      name: user.name,
      tempPassword,
      clinicName: clinicSettings?.clinicName ?? null,
      senderName: clinicSettings?.senderName ?? null,
      fromEmail: clinicSettings?.fromEmail ?? null,
      replyToEmail: clinicSettings?.replyToEmail ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send temp password email — DEV FALLBACK password logged below");
    logger.info({ email: user.email, tempPassword }, "DEV: temp password (email not sent)");
  }

  res.json(genericResponse);
});

// ── POST /auth/resend-access ── (resends temp password email, same rate-limit as request-access)
router.post("/auth/resend-access", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

  const genericResponse = { message: "Se este e-mail estiver cadastrado, você receberá a senha em breve." };

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (users.length === 0 || users[0].role !== "patient") {
    res.json(genericResponse);
    return;
  }

  // Per-IP limit checked first: prevents a single IP from exhausting
  // per-email quotas for patients it does not own.
  if (!await checkIpRateLimit(ip)) {
    res.status(429).json({ error: "Muitas tentativas. Aguarde 1 hora antes de tentar novamente." });
    return;
  }

  if (!await checkRequestAccessRateLimit(email, ip)) {
    res.status(429).json({ error: "Muitas tentativas. Aguarde 1 hora antes de tentar novamente." });
    return;
  }

  const user = users[0];

  const tempPassword = String(Math.floor(100000 + Math.random() * 900000));
  const passwordHash = await hashPassword(tempPassword);
  const temporaryPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await db
    .update(usersTable)
    .set({ passwordHash, isTemporaryPassword: true, temporaryPasswordExpiresAt })
    .where(eq(usersTable.id, user.id));

  try {
    const [clinicSettings] = await db.select().from(clinicSettingsTable).limit(1);
    await sendTempPasswordEmail({
      to: user.email,
      name: user.name,
      tempPassword,
      clinicName: clinicSettings?.clinicName ?? null,
      senderName: clinicSettings?.senderName ?? null,
      fromEmail: clinicSettings?.fromEmail ?? null,
      replyToEmail: clinicSettings?.replyToEmail ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to resend temp password email — DEV FALLBACK password logged below");
    logger.info({ email: user.email, tempPassword }, "DEV: temp password (email not sent)");
  }

  res.json(genericResponse);
});

// ── POST /auth/login ──
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, String(email).toLowerCase().trim()))
    .limit(1);

  if (users.length === 0) {
    req.log.warn({ ip, email: String(email).toLowerCase(), reason: "unknown_email" }, "Failed login attempt");
    res.status(401).json({ error: "Email ou senha incorretos" });
    return;
  }

  const user = users[0];

  if (user.deactivatedAt !== null) {
    req.log.warn({ ip, email: user.email, reason: "deactivated_account", userId: user.id }, "Failed login attempt");
    res.status(401).json({ error: "Esta conta foi desativada. Entre em contato com a clínica." });
    return;
  }

  if (!user.passwordHash) {
    req.log.warn({ ip, email: user.email, reason: "no_password_configured", userId: user.id }, "Failed login attempt");
    res.status(401).json({ error: "Conta não possui senha configurada. Entre em contato com a clínica." });
    return;
  }

  // Reject expired temporary passwords before even verifying the hash
  if (user.isTemporaryPassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt < new Date()) {
    req.log.warn({ ip, email: user.email, reason: "expired_temporary_password", userId: user.id }, "Failed login attempt");
    res.status(401).json({ error: "Sua senha temporária expirou. Solicite uma nova senha para acessar o aplicativo." });
    return;
  }

  const valid = await verifyPassword(String(password), user.passwordHash);
  if (!valid) {
    req.log.warn({ ip, email: user.email, reason: "wrong_password", userId: user.id }, "Failed login attempt");
    await db
      .update(usersTable)
      .set({
        failedLoginCount: sql`${usersTable.failedLoginCount} + 1`,
        lastFailedLoginAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));
    res.status(401).json({ error: "Email ou senha incorretos" });
    return;
  }

  // Reset failed login counter on success
  await db
    .update(usersTable)
    .set({ failedLoginCount: 0, lastFailedLoginAt: null })
    .where(eq(usersTable.id, user.id));

  const token = await signAccessToken(user.id, user.email, user.role);

  // Issue a 7-day refresh token stored as httpOnly cookie
  const { generateRefreshToken, hashRefreshToken } = await import("../lib/jwt");
  const rawRefresh = generateRefreshToken();
  const refreshHash = hashRefreshToken(rawRefresh);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokensTable).values({ userId: user.id, tokenHash: refreshHash, expiresAt });

  // Purge stale refresh tokens (expired or revoked) in the background
  deleteStaleRefreshTokens().catch((err) =>
    logger.error({ err }, "Failed to purge stale refresh tokens")
  );

  res.cookie("refresh_token", rawRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isTemporaryPassword: user.isTemporaryPassword ?? false,
    },
  });
});

// ── POST /auth/refresh ──
router.post("/auth/refresh", async (req, res): Promise<void> => {
  const rawRefresh = req.cookies?.refresh_token as string | undefined;
  if (!rawRefresh) {
    res.status(401).json({ error: "Refresh token não fornecido" });
    return;
  }
  const { hashRefreshToken } = await import("../lib/jwt");
  const tokenHash = hashRefreshToken(rawRefresh);

  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.tokenHash, tokenHash))
    .limit(1);

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    res.status(401).json({ error: "Refresh token inválido ou expirado" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, stored.userId))
    .limit(1);

  if (!user || user.deactivatedAt !== null) {
    res.status(401).json({ error: "Conta não encontrada ou desativada" });
    return;
  }

  const newToken = await signAccessToken(user.id, user.email, user.role);
  res.json({ token: newToken });
});

// ── POST /auth/logout ── (revokes the current refresh token)
router.post("/auth/logout", async (req, res): Promise<void> => {
  const rawRefresh = req.cookies?.refresh_token as string | undefined;

  if (rawRefresh) {
    const { hashRefreshToken } = await import("../lib/jwt");
    const tokenHash = hashRefreshToken(rawRefresh);

    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokensTable.tokenHash, tokenHash), isNull(refreshTokensTable.revokedAt)));
  }

  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
  });

  res.json({ success: true });
});

// ── POST /auth/logout-all ── (revokes ALL active refresh tokens for the current user)
router.post("/auth/logout-all", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const userId = authResult.user.id;

  const revoked = await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokensTable.userId, userId), isNull(refreshTokensTable.revokedAt)))
    .returning({ id: refreshTokensTable.id });

  res.json({ success: true, revokedCount: revoked.length });
});

// ── POST /auth/change-password ──
router.post("/auth/change-password", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = authResult.user;

  // If not temporary password, require current password
  if (!user.isTemporaryPassword && !currentPassword) {
    res.status(400).json({ error: "Senha atual é obrigatória" });
    return;
  }

  if (!user.isTemporaryPassword && user.passwordHash) {
    const valid = await verifyPassword(String(currentPassword), user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Senha atual incorreta" });
      return;
    }
  }

  const wasTemporary = user.isTemporaryPassword === true;

  const newHash = await hashPassword(String(newPassword));
  await db
    .update(usersTable)
    .set({ passwordHash: newHash, isTemporaryPassword: false, temporaryPasswordExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  if (wasTemporary && user.role === "profissional_saude") {
    const [doc] = await db
      .select({ clinicId: doctorsTable.clinicId })
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    await db.insert(staffEventsTable).values({
      userId: user.id,
      clinicId: doc?.clinicId,
      type: "staff_onboarding",
      description: `${user.name} definiu sua senha pessoal e concluiu o cadastro.`,
    });
  }

  res.json({ success: true });
});

// ── POST /auth/forgot-password ── (sends reset link to staff email)
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.json({ success: true });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  // Always return 200 to prevent email enumeration
  if (users.length === 0 || users[0].role === "patient") {
    res.json({ success: true });
    return;
  }

  const user = users[0];

  // Purge stale tokens (expired or already used) before inserting a new one
  deleteStaleResetTokens().catch((err) =>
    logger.error({ err }, "Failed to purge stale reset tokens")
  );

  // Generate a cryptographically secure token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  try {
    const [clinicSettings] = await db.select().from(clinicSettingsTable).limit(1);
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      clinicName: clinicSettings?.clinicName ?? null,
      senderName: clinicSettings?.senderName ?? null,
      fromEmail: clinicSettings?.fromEmail ?? null,
      replyToEmail: clinicSettings?.replyToEmail ?? null,
    });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send password reset email");
  }

  res.json({ success: true });
});

// ── POST /auth/reset-password ── (validates token, sets new password)
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = z
    .object({
      token: z.string().min(1),
      newPassword: z.string().min(8),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos. A senha deve ter pelo menos 8 caracteres." });
    return;
  }

  const { token: rawToken, newPassword } = parsed.data;
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        isNull(passwordResetTokensTable.usedAt)
      )
    )
    .limit(1);

  if (!resetToken) {
    res.status(400).json({ error: "Link inválido ou já utilizado. Solicite um novo link de redefinição." });
    return;
  }

  if (new Date() > resetToken.expiresAt) {
    res.status(400).json({ error: "Este link expirou. Solicite um novo link de redefinição." });
    return;
  }

  const newHash = await hashPassword(newPassword);

  await db
    .update(usersTable)
    .set({ passwordHash: newHash, isTemporaryPassword: false })
    .where(eq(usersTable.id, resetToken.userId));

  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, resetToken.id));

  // Purge all stale tokens (expired or used) in the background
  deleteStaleResetTokens().catch((err) =>
    logger.error({ err }, "Failed to purge stale reset tokens")
  );

  res.json({ success: true });
});

// ── POST /auth/social-login ── (Google or Apple OAuth → patients only)
router.post("/auth/social-login", async (req, res): Promise<void> => {
  const parsed = z
    .object({
      provider: z.enum(["google", "apple"]),
      token: z.string().min(1),
      appleUserId: z.string().optional(),
      email: z.string().email().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const { provider, token, appleUserId, email: emailHint } = parsed.data;
  let email: string | null = null;

  if (provider === "google") {
    try {
      // Verify Google access token and get email
      const r = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        res.status(401).json({ error: "Token do Google inválido" });
        return;
      }
      const info = (await r.json()) as { email?: string; email_verified?: boolean };
      if (!info.email || info.email_verified === false) {
        res.status(401).json({ error: "Email do Google não verificado" });
        return;
      }
      email = info.email.toLowerCase().trim();
    } catch {
      res.status(401).json({ error: "Falha ao verificar token do Google" });
      return;
    }
  } else {
    // Apple: decode JWT payload (base64) to extract email / sub
    try {
      const parts = token.split(".");
      if (parts.length < 2) throw new Error("Invalid JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
        email?: string;
        sub?: string;
      };

      if (payload.email) {
        email = payload.email.toLowerCase().trim();
      } else if (appleUserId) {
        // Subsequent Apple sign-in — look up by apple_user_id
        const rows = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.appleUserId, appleUserId))
          .limit(1);
        if (rows.length > 0) {
          email = rows[0].email;
        }
      }
      if (!email && emailHint) email = emailHint.toLowerCase().trim();
    } catch {
      res.status(401).json({ error: "Token da Apple inválido" });
      return;
    }
  }

  if (!email) {
    res.status(401).json({ error: "Não foi possível obter o email do provedor social" });
    return;
  }

  // Check email is a registered patient
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (users.length === 0 || users[0].role !== "patient") {
    res.status(403).json({
      error: "Este email não está autorizado. Entre em contato com a clínica para ser cadastrado.",
    });
    return;
  }

  const user = users[0];

  if (user.deactivatedAt !== null) {
    res.status(401).json({ error: "Esta conta foi desativada. Entre em contato com a clínica." });
    return;
  }

  // Store Apple user ID for future sign-ins (only on first Apple login)
  if (provider === "apple" && appleUserId && !user.appleUserId) {
    await db
      .update(usersTable)
      .set({ appleUserId })
      .where(eq(usersTable.id, user.id));
  }

  const jwtToken = await signAccessToken(user.id, user.email, user.role);
  res.json({
    token: jwtToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isTemporaryPassword: false,
    },
  });
});

// ── POST /auth/register ── (Staff accounts: profissional_saude / clinic_owner)
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, name, role, specialty, cpf, rg, phone, birthDate, avatarUrl } = parsed.data as typeof parsed.data & {
    specialty?: string;
    cpf?: string;
    rg?: string;
    phone?: string;
    birthDate?: string;
    avatarUrl?: string;
  };
  const normalizedCpf = cpf ? normalizeCpf(cpf) : null;

  // Block self-registration for profissional_saude — only clinic_owner can create these accounts
  let ownerClinicId: number | undefined;
  if (role === "profissional_saude") {
    const authResult = await requireAuth(req);
    if (isError(authResult) || authResult.user.role !== "clinic_owner") {
      res.status(403).json({ error: "Profissionais de saúde só podem ser criados pelo administrador da clínica." });
      return;
    }
    // Resolve owner's clinic so the new doctor is linked to it
    ownerClinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
    if (!ownerClinicId) {
      res.status(400).json({ error: "Administrador não tem clínica vinculada." });
      return;
    }
  }

  // Validate CPF is required for clinic_owner
  if (role === "clinic_owner" && !normalizedCpf) {
    res.status(400).json({ error: "CPF é obrigatório para administradores de clínica." });
    return;
  }
  if (normalizedCpf && !isValidCpf(normalizedCpf)) {
    res.status(400).json({ error: "CPF inválido" });
    return;
  }

  // Check if email already exists
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email já cadastrado" });
    return;
  }

  // Check CPF uniqueness
  if (normalizedCpf) {
    const existingCpf = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.cpf, normalizedCpf))
      .limit(1);
    if (existingCpf.length > 0) {
      res.status(409).json({ error: "CPF já cadastrado" });
      return;
    }
  }

  const passwordHash = await hashPassword(password);
  const newUser = await db
    .insert(usersTable)
    .values({
      clerkId: `manual_${Date.now()}`,
      email: email.toLowerCase().trim(),
      name,
      role,
      passwordHash,
      isTemporaryPassword: false,
      cpf: normalizedCpf ?? null,
      rg: rg ?? null,
      phone: phone ?? null,
      birthDate: birthDate ?? null,
      avatarUrl: avatarUrl ?? null,
    })
    .returning();

  const user = newUser[0];

  // Auto-create doctor profile for profissional_saude, linked to the owner's clinic
  if (role === "profissional_saude" && ownerClinicId) {
    const validSpecialties = ["nutritionist", "psychologist", "endocrinologist", "general", "other"] as const;
    type Specialty = typeof validSpecialties[number];
    const spec: Specialty = (validSpecialties as readonly string[]).includes(specialty ?? "") ? (specialty as Specialty) : "general";
    await db.insert(doctorsTable).values({ userId: user.id, specialty: spec, clinicId: ownerClinicId });
  }

  const token = await signAccessToken(user.id, user.email, user.role);
  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isTemporaryPassword: false,
    },
  });
});

// ── PATCH /users/me ── (any authenticated user updates their own profile)
router.patch("/users/me", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = z
    .object({
      name: z.string().trim().min(1).optional(),
      email: z.string().trim().email().optional(),
      avatarUrl: z.string().nullable().optional(),
      cpf: z.string().nullable().optional(),
      rg: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      birthDate: z.string().nullable().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, avatarUrl, cpf, rg, phone, birthDate } = parsed.data;

  if (
    name === undefined
    && email === undefined
    && avatarUrl === undefined
    && cpf === undefined
    && rg === undefined
    && phone === undefined
    && birthDate === undefined
  ) {
    res.status(400).json({ error: "Nenhum campo para atualizar" });
    return;
  }

  const hasOwnerFields = email !== undefined
    || cpf !== undefined
    || rg !== undefined
    || phone !== undefined
    || birthDate !== undefined;
  if (hasOwnerFields && authResult.user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas o owner pode atualizar esses dados" });
    return;
  }

  const normalizedEmail = email?.toLowerCase();
  if (normalizedEmail !== undefined) {
    const [existingEmail] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);
    if (existingEmail && existingEmail.id !== authResult.user.id) {
      res.status(409).json({ error: "Este e-mail já está em uso" });
      return;
    }
  }

  const normalizedCpf = cpf == null || !normalizeCpf(cpf) ? null : normalizeCpf(cpf);
  if (normalizedCpf && !isValidCpf(normalizedCpf)) {
    res.status(400).json({ error: "CPF inválido" });
    return;
  }
  if (normalizedCpf) {
    const [existingCpf] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.cpf, normalizedCpf))
      .limit(1);
    if (existingCpf && existingCpf.id !== authResult.user.id) {
      res.status(409).json({ error: "Este CPF já está em uso" });
      return;
    }
  }

  const normalizedPhone = phone?.trim() || null;
  if (normalizedPhone) {
    const phoneDigits = normalizedPhone.replace(/\D/g, "");
    if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
      res.status(400).json({ error: "Telefone inválido" });
      return;
    }
  }

  if (birthDate) {
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate)
      ? new Date(`${birthDate}T00:00:00.000Z`)
      : null;
    if (
      !parsedDate
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString().slice(0, 10) !== birthDate
    ) {
      res.status(400).json({ error: "Data de nascimento inválida" });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (normalizedEmail !== undefined) updates.email = normalizedEmail;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  if (cpf !== undefined) updates.cpf = normalizedCpf;
  if (rg !== undefined) updates.rg = rg?.trim() || null;
  if (phone !== undefined) updates.phone = normalizedPhone;
  if (birthDate !== undefined) updates.birthDate = birthDate || null;
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, authResult.user.id))
    .returning();

  let patientId: number | null = null;
  if (updated.role === "patient") {
    const [pat] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, updated.id))
      .limit(1);
    patientId = pat?.id ?? null;
  }

  res.json({
    id: updated.id,
    clerkId: updated.clerkId ?? null,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    avatarUrl: updated.avatarUrl ?? null,
    isTemporaryPassword: updated.isTemporaryPassword ?? false,
    createdAt: updated.createdAt.toISOString(),
    patientId,
    cpf: updated.cpf ?? null,
    rg: updated.rg ?? null,
    phone: updated.phone ?? null,
    birthDate: updated.birthDate ?? null,
  });
});

// ── GET /auth/my-clinics ── (list clinics the authenticated user can access)
router.get("/auth/my-clinics", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role === "clinic_owner") {
    const clinics = await db
      .select({
        id: clinicsTable.id,
        name: clinicsTable.name,
        logoUrl: clinicsTable.logoUrl,
        primaryColor: clinicsTable.primaryColor,
      })
      .from(clinicOwnersTable)
      .innerJoin(clinicsTable, eq(clinicOwnersTable.clinicId, clinicsTable.id))
      .where(eq(clinicOwnersTable.userId, user.id))
      .orderBy(clinicsTable.name);

    const enriched = await Promise.all(
      clinics.map(async (clinic) => {
        const [doctorCountRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(doctorsTable)
          .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
          .where(and(eq(doctorsTable.clinicId, clinic.id), isNull(usersTable.deactivatedAt)));

        const [settings] = await db
          .select({ plan: clinicSettingsTable.plan })
          .from(clinicSettingsTable)
          .where(eq(clinicSettingsTable.clinicId, clinic.id))
          .limit(1);

        const plan = settings?.plan ?? "basic";

        return {
          ...clinic,
          doctorCount: Number(doctorCountRow?.count ?? 0),
          plan,
          planLabel: PLAN_LABELS[plan] ?? plan,
        };
      })
    );

    res.json(enriched);
    return;
  }

  if (user.role === "patient") {
    const [patient] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, user.id))
      .limit(1);

    if (!patient) {
      res.status(404).json({ error: "Paciente não encontrado." });
      return;
    }

    const clinics = await db
      .select({
        id: clinicsTable.id,
        name: clinicsTable.name,
        logoUrl: clinicsTable.logoUrl,
        primaryColor: clinicsTable.primaryColor,
      })
      .from(patientClinicsTable)
      .innerJoin(clinicsTable, eq(patientClinicsTable.clinicId, clinicsTable.id))
      .where(eq(patientClinicsTable.patientId, patient.id))
      .orderBy(clinicsTable.name);
    res.json(clinics);
    return;
  }

  res.status(403).json({ error: "Apenas pacientes e clinic owners podem listar clínicas." });
});

// ── POST /auth/select-clinic ── (patient or clinic_owner gets a clinic-scoped JWT)
router.post("/auth/select-clinic", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role !== "patient" && user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas pacientes e clinic owners podem selecionar uma clínica." });
    return;
  }

  const parsed = z.object({ clinicId: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "clinicId inválido" });
    return;
  }
  const { clinicId } = parsed.data;

  // Verify clinic exists
  const [clinic] = await db
    .select()
    .from(clinicsTable)
    .where(eq(clinicsTable.id, clinicId))
    .limit(1);

  if (!clinic) {
    res.status(404).json({ error: "Clínica não encontrada." });
    return;
  }

  if (user.role === "clinic_owner") {
    // Verify this user owns the clinic
    const [ownerRow] = await db
      .select()
      .from(clinicOwnersTable)
      .where(and(eq(clinicOwnersTable.userId, user.id), eq(clinicOwnersTable.clinicId, clinicId)))
      .limit(1);
    if (!ownerRow) {
      res.status(403).json({ error: "Você não é dono desta clínica." });
      return;
    }
  } else {
    // patient: verify enrollment
    const [patient] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, user.id))
      .limit(1);

    if (!patient) {
      res.status(404).json({ error: "Paciente não encontrado." });
      return;
    }

    const [enrollment] = await db
      .select()
      .from(patientClinicsTable)
      .where(
        and(
          eq(patientClinicsTable.patientId, patient.id),
          eq(patientClinicsTable.clinicId, clinicId)
        )
      )
      .limit(1);

    if (!enrollment) {
      res.status(403).json({ error: "Você não está inscrito nesta clínica." });
      return;
    }
  }

  const token = await signClinicScopedToken(user.id, user.email, user.role, clinicId);
  res.json({
    token,
    clinicId,
    clinic: {
      id: clinic.id,
      name: clinic.name,
      logoUrl: clinic.logoUrl ?? null,
      primaryColor: clinic.primaryColor ?? null,
    },
  });
});

// ── POST /auth/complete-profile ── (Clerk-only, for web onboarding)
router.post("/auth/complete-profile", async (req, res): Promise<void> => {
  if (!isClerkConfigured()) {
    res.status(503).json({
      error: {
        code: "integration_not_configured",
        message: "Integração Clerk não configurada.",
      },
    });
    return;
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated || authResult.strategy !== "clerk") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CompleteProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, role, avatarUrl } = parsed.data;

  // Get email from Clerk session
  const clerkId = authResult.user.clerkId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const email = authResult.user.email;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  let user;
  if (existing.length > 0) {
    const updated = await db
      .update(usersTable)
      .set({ name, role, avatarUrl: avatarUrl ?? null })
      .where(eq(usersTable.clerkId, clerkId))
      .returning();
    user = updated[0];
  } else {
    const created = await db
      .insert(usersTable)
      .values({ clerkId, email, name, role, avatarUrl: avatarUrl ?? null })
      .returning();
    user = created[0];
  }

  res.json({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
