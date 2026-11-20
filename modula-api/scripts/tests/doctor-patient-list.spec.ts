/**
 * E2E spec: patient list behaviour for a profissional_saude (doctor)
 *
 * Scenario A — Doctor with NO assigned patients
 *   The /api/patients route returns [] early when no assignments exist.
 *   The web UI must render the empty state without crashing.
 *
 * Scenario B — Doctor WITH assigned patients
 *   After a patient is created and assigned to the doctor, the patients page
 *   must list that patient correctly.
 */

import { test, expect, request as apiRequest, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:80";

const OWNER_EMAIL = "testowner_doctorlist@clinic.com";
const OWNER_PASSWORD = "Test1234!";

// ── helpers ──────────────────────────────────────────────────────────────────

async function ensureOwnerToken(): Promise<string> {
  const ctx = await apiRequest.newContext({ baseURL: BASE_URL });

  const loginRes = await ctx.post("/api/auth/login", {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  if (loginRes.ok()) {
    const body = await loginRes.json();
    await ctx.dispose();
    return body.token as string;
  }

  const regRes = await ctx.post("/api/auth/register", {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD, name: "Test Owner DoctorList", role: "clinic_owner" },
  });
  if (!regRes.ok()) throw new Error(`Cannot create owner: ${await regRes.text()}`);
  const body = await regRes.json();
  await ctx.dispose();
  return body.token as string;
}

async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.waitForSelector("input[placeholder='seu@email.com']", { timeout: 10_000 });
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.getByPlaceholder("Digite sua senha").fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  // Accept either dashboard or change-password (temp-password accounts)
  await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 15_000 });
}

// ── suite ─────────────────────────────────────────────────────────────────────

test.describe("Doctor patient list — /patients page", () => {
  let ownerToken: string;

  /** A fresh doctor account guaranteed to have zero patient assignments. */
  const suffix = Date.now();
  const freshDoctorEmail = `doctor_nopatients_${suffix}@clinic.com`;
  const freshDoctorPassword = "Test1234!";
  let freshDoctorId: number; // doctors table row id

  test.beforeAll(async ({ playwright }) => {
    ownerToken = await ensureOwnerToken();

    const ctx = await playwright.request.newContext({ baseURL: BASE_URL });

    // Register the fresh doctor (requires owner auth header)
    const regRes = await ctx.post("/api/auth/register", {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        email: freshDoctorEmail,
        password: freshDoctorPassword,
        name: "Dra. Teste SemPaciente",
        role: "profissional_saude",
      },
    });
    if (!regRes.ok()) throw new Error(`Cannot register fresh doctor: ${await regRes.text()}`);

    // Discover the doctor's doctors-table row id from the doctors list
    const doctorsRes = await ctx.get("/api/doctors", {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (!doctorsRes.ok()) throw new Error(`Cannot list doctors: ${await doctorsRes.text()}`);
    const doctorsList: Array<{ id: number; email: string }> = await doctorsRes.json();
    const record = doctorsList.find((d) => d.email === freshDoctorEmail);
    if (!record) throw new Error(`Fresh doctor not found in /api/doctors list (email: ${freshDoctorEmail})`);
    freshDoctorId = record.id;

    await ctx.dispose();
  });

  // ── Scenario A: no assigned patients ──────────────────────────────────────

  test("Scenario A — empty list loads without error when doctor has no patients", async ({ page }) => {
    await loginViaUI(page, freshDoctorEmail, freshDoctorPassword);
    await page.goto("/patients");
    await page.waitForLoadState("networkidle");

    // No Vite/React error overlay
    const errorOverlay = page.locator("#vite-error-overlay, [data-testid='error-overlay']");
    await expect(errorOverlay).not.toBeVisible();

    // Page heading must be present (proves component mounted)
    await expect(page.getByRole("heading", { name: /pacientes/i })).toBeVisible({ timeout: 10_000 });

    // Search input must render
    await expect(page.getByPlaceholder(/buscar pacientes/i)).toBeVisible();

    // Empty state message (returned by API early-exit when no assignments)
    await expect(
      page.getByText(/nenhum paciente cadastrado ainda/i)
    ).toBeVisible({ timeout: 10_000 });

    // Patient counter shows 0
    await expect(page.getByText(/0 paciente/i)).toBeVisible();
  });

  // ── Scenario B: doctor has assigned patients ───────────────────────────────

  test("Scenario B — assigned patient appears in the list", async ({ page, request }) => {
    const ts = Date.now();
    const assignedPatientName = `Paciente Lista ${ts}`;
    const patientEmail = `pat_lista_${ts}@example.com`;

    // Create a patient (owner privilege)
    const createRes = await request.post("/api/patients", {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: {
        name: assignedPatientName,
        email: patientEmail,
        startWeight: 85,
        dateOfBirth: "1992-05-15",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const newPatient = await createRes.json();
    const patientId: number = newPatient.id;

    // Assign the fresh doctor to this patient
    const assignRes = await request.post(`/api/patients/${patientId}/doctors`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { doctorId: freshDoctorId },
    });
    expect(assignRes.ok()).toBeTruthy();

    // Log in as the doctor and navigate to /patients
    await loginViaUI(page, freshDoctorEmail, freshDoctorPassword);
    await page.goto("/patients");
    await page.waitForLoadState("networkidle");

    // The assigned patient must appear in the list
    await expect(page.getByText(assignedPatientName)).toBeVisible({ timeout: 10_000 });

    // The empty-state message must NOT be shown
    await expect(page.getByText(/nenhum paciente cadastrado ainda/i)).not.toBeVisible();

    // Counter shows at least 1 patient
    await expect(page.getByText(/[1-9]\d* paciente/)).toBeVisible();
  });
});
