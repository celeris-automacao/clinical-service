/**
 * E2E spec: "Reenviar convite" button visibility lifecycle
 *
 * Covers the complete four-step flow in a single deterministic scenario:
 *
 *  Step 1 — Button IS visible when patient has a temporary password (freshly created account).
 *  Step 2 — Staff successfully re-sends the invite (valid while isTemporaryPassword=true).
 *            Navigating away and back confirms the button remains visible.
 *  Step 3 — Patient sets their own password. Button disappears on the next page load.
 *  Step 4 — Staff triggers POST /api/auth/request-access (the "forgot password" flow for patients),
 *            which resets isTemporaryPassword=true regardless of current state. Button reappears.
 *
 * Note on resend-invite after own-password is set:
 *   POST /api/patients/:id/resend-invite intentionally returns 409 when isTemporaryPassword=false,
 *   to protect the patient's self-chosen password from being overwritten. The supported staff-side
 *   mechanism to return a patient to the temporary-password state is POST /api/auth/request-access.
 */

import { test, expect, request as apiRequest } from "@playwright/test";

const OWNER_EMAIL = "testowner_task81@clinic.com";
const OWNER_PASSWORD = "Test1234!";

async function ensureOwnerToken(baseURL: string): Promise<string> {
  const ctx = await apiRequest.newContext({ baseURL });
  const loginRes = await ctx.post("/api/auth/login", {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  if (loginRes.ok()) {
    const body = await loginRes.json();
    await ctx.dispose();
    return body.token as string;
  }
  const regRes = await ctx.post("/api/auth/register", {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD, name: "Test Owner Task81", role: "clinic_owner" },
  });
  if (!regRes.ok()) throw new Error(`Cannot create owner: ${await regRes.text()}`);
  const body = await regRes.json();
  await ctx.dispose();
  return body.token as string;
}

async function loginAsOwner(page: any) {
  await page.goto("/login");
  await page.waitForSelector("input[placeholder='seu@email.com']");
  await page.getByPlaceholder("seu@email.com").fill(OWNER_EMAIL);
  await page.getByPlaceholder("Digite sua senha").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 15_000 });
}

test.describe("Reenviar convite button — isTemporaryPassword lifecycle", () => {
  const BASE_URL = "http://localhost:80";

  let ownerToken: string;
  let patientId: number;
  let patientEmail: string;
  /**
   * JWT obtained by logging in as the patient with their initial temporary password.
   * Captured before any resend call rotates the password, so it remains usable throughout
   * the suite via the Authorization header (JWT validity is independent of password changes).
   */
  let patientToken: string;

  test.beforeAll(async ({ playwright }) => {
    ownerToken = await ensureOwnerToken(BASE_URL);

    const ctx = await apiRequest.newContext({ baseURL: BASE_URL });
    const suffix = Date.now();
    patientEmail = `patient_task81_${suffix}@example.com`;

    // Create patient (isTemporaryPassword=true)
    const patRes = await ctx.post("/api/patients", {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { name: "Paciente Task81", email: patientEmail, startWeight: 80, dateOfBirth: "1990-01-01" },
    });
    if (!patRes.ok()) throw new Error(`Cannot create patient: ${await patRes.text()}`);
    const pat = await patRes.json();
    patientId = pat.id;

    // Log in as the patient immediately to capture a valid JWT before any password rotation
    const loginRes = await ctx.post("/api/auth/login", {
      data: { email: patientEmail, password: pat.temporaryPassword },
    });
    if (!loginRes.ok()) throw new Error(`Cannot log in as patient: ${await loginRes.text()}`);
    patientToken = (await loginRes.json()).token;

    await ctx.dispose();
  });

  test("step 1 — button visible when patient has a temporary password", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`/patients/${patientId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /reenviar convite/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/senha temporária ainda ativa/i)).toBeVisible();
  });

  test("step 2 — button remains visible after staff successfully re-sends the invite", async ({ page, request }) => {
    // resend-invite is valid here because isTemporaryPassword is still true
    const resendRes = await request.post(`/api/patients/${patientId}/resend-invite`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(resendRes.ok()).toBeTruthy();
    expect((await resendRes.json()).success).toBe(true);

    // Navigate to patient detail — button must still be present after the resend
    await loginAsOwner(page);
    await page.goto(`/patients/${patientId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /reenviar convite/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/senha temporária ainda ativa/i)).toBeVisible();
  });

  test("step 3 — button disappears after patient sets their own password", async ({ page, request }) => {
    // Use the pre-captured patient JWT (still valid even though the temp password was rotated by resend)
    const changeRes = await request.post("/api/auth/change-password", {
      headers: { Authorization: `Bearer ${patientToken}` },
      data: { newPassword: "NewSecurePass99!" },
    });
    expect(changeRes.ok()).toBeTruthy();

    // Staff navigates to patient detail — button must now be absent
    await loginAsOwner(page);
    await page.goto(`/patients/${patientId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /reenviar convite/i })).not.toBeVisible();
    await expect(page.getByText(/senha temporária ainda ativa/i)).not.toBeVisible();
  });

  test("step 4 — button reappears after request-access resets patient to temporary password", async ({ page, request }) => {
    // POST /api/auth/request-access is the supported flow for setting isTemporaryPassword=true again.
    // It overwrites the password hash and marks the account as temporary regardless of current state.
    // Email delivery may fail in CI without SMTP — we accept 200 or 502; only 404 is a real error.
    const resetRes = await request.post("/api/auth/request-access", {
      data: { email: patientEmail },
    });
    expect(resetRes.status()).not.toBe(404);

    // Staff navigates to patient detail — button must be visible again
    await loginAsOwner(page);
    await page.goto(`/patients/${patientId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: /reenviar convite/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/senha temporária ainda ativa/i)).toBeVisible();
  });
});
