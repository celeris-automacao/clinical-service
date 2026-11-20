import { test, expect, request } from "@playwright/test";

const EXPO_DOMAIN = process.env.REPLIT_EXPO_DEV_DOMAIN ?? "";
const MOBILE_BASE = `https://${EXPO_DOMAIN}`;
const API_BASE = "http://localhost:80";

const PATIENT_EMAIL = "eng.nayara@gmail.com";
const PATIENT_PASSWORD = "123456";
const PATIENT_USER_ID = "24";
const CLINIC_ID = 1;
const CLINIC_NAME = "KLIE";

test.use({
  viewport: { width: 400, height: 720 },
});

test.beforeEach(async () => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const loginResp = await apiCtx.post("/api/auth/login", {
    data: { email: PATIENT_EMAIL, password: PATIENT_PASSWORD },
  });
  const { token: plainToken } = await loginResp.json() as { token: string };

  await apiCtx.post("/api/patients/me/consent", {
    headers: { Authorization: `Bearer ${plainToken}` },
    data: {},
  });

  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(
    "DELETE FROM data_deletion_requests WHERE user_id = $1",
    [parseInt(PATIENT_USER_ID, 10)]
  );
  await client.query(
    "UPDATE users SET deletion_requested_at = NULL WHERE id = $1",
    [parseInt(PATIENT_USER_ID, 10)]
  );
  await client.end();

  await apiCtx.dispose();
});

test("LGPD consent revocation flow — badge Ativo → Inativo and delete-request", async ({ page }) => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const loginResp = await apiCtx.post("/api/auth/login", {
    data: { email: PATIENT_EMAIL, password: PATIENT_PASSWORD },
  });
  expect(loginResp.ok()).toBeTruthy();
  const { token: plainToken } = await loginResp.json() as { token: string };

  const selectResp = await apiCtx.post("/api/auth/select-clinic", {
    headers: { Authorization: `Bearer ${plainToken}` },
    data: { clinicId: CLINIC_ID },
  });
  expect(selectResp.ok()).toBeTruthy();
  const { token: scopedToken } = await selectResp.json() as { token: string };

  await apiCtx.dispose();

  await page.goto(`${MOBILE_BASE}/`);
  await page.evaluate(
    ({ token, userId, clinicId, clinicName }) => {
      localStorage.setItem("@clinic_auth_token", token);
      localStorage.setItem("@clinic_auth_user_id", userId);
      localStorage.setItem("@clinic_auth_role", "patient");
      localStorage.setItem("@clinic_selected_clinic_id", String(clinicId));
      localStorage.setItem("@clinic_selected_clinic_name", clinicName);
    },
    { token: scopedToken, userId: PATIENT_USER_ID, clinicId: CLINIC_ID, clinicName: CLINIC_NAME }
  );

  await page.goto(`${MOBILE_BASE}/`);
  await page.waitForSelector("text=Nayara", { timeout: 20000 });

  const profileTab = page
    .locator('a:has-text("Perfil"), [role="link"]:has-text("Perfil")')
    .first();
  await expect(profileTab).toBeVisible({ timeout: 15000 });
  await profileTab.click();
  await page.waitForURL((url) => url.href.includes("profile"), { timeout: 15000 });

  await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
  await page.waitForTimeout(1500);
  await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");

  await expect(page.getByText("Privacidade & LGPD")).toBeVisible({ timeout: 10000 });

  await expect(page.getByText("Ativo").first()).toBeVisible({ timeout: 10000 });

  const revokeBtn = page.locator('[data-testid="button-revoke-consent"]');
  await expect(revokeBtn).toBeVisible({ timeout: 10000 });
  const isDisabledBefore = await revokeBtn.getAttribute("aria-disabled");
  expect(isDisabledBefore).not.toBe("true");

  const deleteBtn = page.locator('[data-testid="button-request-deletion"]');
  await expect(deleteBtn).toBeVisible({ timeout: 10000 });

  // Intercept LGPD API calls to record what actually fires.
  // route.continue() passes each request through; we record method, path, status.
  const intercepted: { method: string; path: string; status: number }[] = [];
  await page.route("**/api/patients/me/**", async (route) => {
    const req = route.request();
    const response = await route.fetch();
    intercepted.push({
      method: req.method(),
      path: new URL(req.url()).pathname,
      status: response.status(),
    });
    await route.fulfill({ response });
  });

  // Register a persistent dialog handler BEFORE any click so it catches every
  // window.confirm() that fires during this test.  We track which dialogs appeared.
  const dialogs: { type: string; message: string }[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    dialog.accept();
  });

  // --- Revoke consent ---
  await revokeBtn.click();
  // Badge must flip to "Inativo" — proves DELETE /patients/me/consent was sent and the
  // server responded successfully (the mutation only updates state on success).
  await expect(page.getByText("Inativo").first()).toBeVisible({ timeout: 15000 });

  const isDisabledAfter = await revokeBtn.getAttribute("aria-disabled");
  expect(isDisabledAfter).toBe("true");

  // Verify the confirm dialog fired before the revoke.
  const revokeDialogEntry = dialogs.find(
    (d) => d.type === "confirm" && d.message.length > 0
  );
  expect(revokeDialogEntry).toBeDefined();
  expect(revokeDialogEntry!.message).toContain("consentimento");

  // Verify DELETE /patients/me/consent was intercepted with HTTP 200.
  const revokeCall = intercepted.find(
    (c) => c.method === "DELETE" && c.path.includes("/patients/me/consent")
  );
  expect(revokeCall).toBeDefined();
  expect(revokeCall!.status).toBe(200);

  // --- Delete request ---
  await deleteBtn.click();
  // Wait briefly for the POST to complete (dialog accepted, fetch fires, handler stores result).
  await page.waitForTimeout(4000);

  const deleteDialogEntry = dialogs.find(
    (d) => d.type === "confirm" && d.message.includes("exclusão")
  );
  expect(deleteDialogEntry).toBeDefined();
  expect(deleteDialogEntry!.message.length).toBeGreaterThan(0);

  // Verify POST /patients/me/delete-request was intercepted with HTTP 201.
  const deleteCall = intercepted.find(
    (c) => c.method === "POST" && c.path.includes("/patients/me/delete-request")
  );
  expect(deleteCall).toBeDefined();
  expect(deleteCall!.status).toBe(201);
});

test("LGPD API — GET consent returns Ativo with clinic-scoped token", async () => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const loginResp = await apiCtx.post("/api/auth/login", {
    data: { email: PATIENT_EMAIL, password: PATIENT_PASSWORD },
  });
  const { token: plainToken } = await loginResp.json() as { token: string };

  const selectResp = await apiCtx.post("/api/auth/select-clinic", {
    headers: { Authorization: `Bearer ${plainToken}` },
    data: { clinicId: CLINIC_ID },
  });
  const { token: scopedToken } = await selectResp.json() as { token: string };

  const consentResp = await apiCtx.get("/api/patients/me/consent", {
    headers: { Authorization: `Bearer ${scopedToken}` },
  });
  expect(consentResp.ok()).toBeTruthy();
  const consent = await consentResp.json() as { hasConsent: boolean };
  expect(consent.hasConsent).toBe(true);

  await apiCtx.dispose();
});

test("LGPD API — DELETE consent revokes, subsequent GET returns Inativo", async () => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const loginResp = await apiCtx.post("/api/auth/login", {
    data: { email: PATIENT_EMAIL, password: PATIENT_PASSWORD },
  });
  const { token: plainToken } = await loginResp.json() as { token: string };

  const selectResp = await apiCtx.post("/api/auth/select-clinic", {
    headers: { Authorization: `Bearer ${plainToken}` },
    data: { clinicId: CLINIC_ID },
  });
  const { token: scopedToken } = await selectResp.json() as { token: string };

  const revokeResp = await apiCtx.delete("/api/patients/me/consent", {
    headers: { Authorization: `Bearer ${scopedToken}` },
    data: {},
  });
  expect(revokeResp.ok()).toBeTruthy();
  const revokeBody = await revokeResp.json() as { success: boolean };
  expect(revokeBody.success).toBe(true);

  const afterResp = await apiCtx.get("/api/patients/me/consent", {
    headers: { Authorization: `Bearer ${scopedToken}` },
  });
  expect(afterResp.ok()).toBeTruthy();
  const afterConsent = await afterResp.json() as { hasConsent: boolean };
  expect(afterConsent.hasConsent).toBe(false);

  await apiCtx.dispose();
});

test("LGPD API — POST delete-request returns 201, duplicate returns 409", async () => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const loginResp = await apiCtx.post("/api/auth/login", {
    data: { email: PATIENT_EMAIL, password: PATIENT_PASSWORD },
  });
  const { token: plainToken } = await loginResp.json() as { token: string };

  const selectResp = await apiCtx.post("/api/auth/select-clinic", {
    headers: { Authorization: `Bearer ${plainToken}` },
    data: { clinicId: CLINIC_ID },
  });
  const { token: scopedToken } = await selectResp.json() as { token: string };

  const firstResp = await apiCtx.post("/api/patients/me/delete-request", {
    headers: { Authorization: `Bearer ${scopedToken}` },
    data: {},
  });
  expect(firstResp.status()).toBe(201);
  const firstBody = await firstResp.json() as { id: number; requestedAt: string };
  expect(typeof firstBody.id).toBe("number");
  expect(typeof firstBody.requestedAt).toBe("string");

  const dupResp = await apiCtx.post("/api/patients/me/delete-request", {
    headers: { Authorization: `Bearer ${scopedToken}` },
    data: {},
  });
  expect(dupResp.status()).toBe(409);

  await apiCtx.dispose();
});
