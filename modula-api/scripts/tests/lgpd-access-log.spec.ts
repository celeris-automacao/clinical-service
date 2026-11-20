import { test, expect, request } from "@playwright/test";

const API_BASE = "http://localhost:80";

const OWNER_EMAIL = "carlos@gmail.com";
const OWNER_PASSWORD = "123456";
const OWNER_NAME = "Carlos Oliveira de Souza";

const DOCTOR_EMAIL = "ligia@clinica.dev";
const DOCTOR_PASSWORD = "123456";
const DOCTOR_NAME = "Dra. Lígia Mendonça";

const SECRETARY_EMAIL = "secretaria@gmail.com";
const SECRETARY_PASSWORD = "123456";
const SECRETARY_NAME = "Sandra Almeida Ferreira";

const NAYARA_NAME = "Nayara de Souza";
const ANA_NAME = "Ana Beatriz Costa";
const KLIE_NAME = "KLIE";

test.use({ viewport: { width: 1280, height: 720 } });

async function getOwnerScopedToken(
  apiCtx: Awaited<ReturnType<typeof request.newContext>>
): Promise<{ plainToken: string; scopedToken: string; userId: number; clinicId: number }> {
  const loginResp = await apiCtx.post("/api/auth/login", {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  expect(loginResp.ok()).toBeTruthy();
  const { token: plainToken, user } = (await loginResp.json()) as { token: string; user: { id: number } };

  const clinicsResp = await apiCtx.get("/api/auth/my-clinics", {
    headers: { Authorization: `Bearer ${plainToken}` },
  });
  expect(clinicsResp.ok()).toBeTruthy();
  const clinics = (await clinicsResp.json()) as Array<{ id: number; name: string }>;
  const klieClinic = clinics.find((c) => c.name === KLIE_NAME);
  expect(klieClinic).toBeDefined();
  const clinicId = klieClinic!.id;

  const selectResp = await apiCtx.post("/api/auth/select-clinic", {
    headers: { Authorization: `Bearer ${plainToken}` },
    data: { clinicId },
  });
  expect(selectResp.ok()).toBeTruthy();
  const { token: scopedToken } = (await selectResp.json()) as { token: string };

  return { plainToken, scopedToken, userId: user.id, clinicId };
}

async function getDoctorToken(
  apiCtx: Awaited<ReturnType<typeof request.newContext>>
): Promise<{ token: string; userId: number }> {
  const loginResp = await apiCtx.post("/api/auth/login", {
    data: { email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD },
  });
  expect(loginResp.ok()).toBeTruthy();
  const { token, user } = (await loginResp.json()) as { token: string; user: { id: number } };
  return { token, userId: user.id };
}

async function getSecretaryToken(
  apiCtx: Awaited<ReturnType<typeof request.newContext>>
): Promise<{ token: string; userId: number }> {
  const loginResp = await apiCtx.post("/api/auth/login", {
    data: { email: SECRETARY_EMAIL, password: SECRETARY_PASSWORD },
  });
  expect(loginResp.ok()).toBeTruthy();
  const { token, user } = (await loginResp.json()) as { token: string; user: { id: number } };
  return { token, userId: user.id };
}

async function findPatientId(
  apiCtx: Awaited<ReturnType<typeof request.newContext>>,
  token: string,
  patientName: string
): Promise<number> {
  const resp = await apiCtx.get("/api/patients", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(resp.ok()).toBeTruthy();
  const patients = (await resp.json()) as Array<{ id: number; name: string }>;
  const patient = patients.find((p) => p.name === patientName);
  expect(patient, `patient "${patientName}" not found`).toBeDefined();
  return patient!.id;
}

test("LGPD access log API — clinic_owner access is attributed correctly", async () => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const { scopedToken } = await getOwnerScopedToken(apiCtx);

  const nayaraId = await findPatientId(apiCtx, scopedToken, NAYARA_NAME);

  await apiCtx.get(`/api/patients/${nayaraId}`, {
    headers: { Authorization: `Bearer ${scopedToken}` },
  });

  const logsResp = await apiCtx.get("/api/clinics/me/access-logs?limit=20", {
    headers: { Authorization: `Bearer ${scopedToken}` },
  });
  expect(logsResp.ok()).toBeTruthy();

  const logs = (await logsResp.json()) as Array<{
    id: number;
    accessorName: string;
    accessorRole: string;
    patientName: string;
    clinicId: number | null;
    fieldsAccessed: string[];
    accessedAt: string;
  }>;

  expect(logs.length).toBeGreaterThan(0);

  const entry = logs.find(
    (l) => l.accessorRole === "clinic_owner" && l.patientName === NAYARA_NAME
  );
  expect(entry, "clinic_owner entry for Nayara not found").toBeDefined();
  expect(entry!.accessorName).toBe(OWNER_NAME);
  expect(entry!.clinicId).not.toBeNull();
  expect(entry!.fieldsAccessed.length).toBeGreaterThan(0);
  expect(new Date(entry!.accessedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);

  await apiCtx.dispose();
});

test("LGPD access log API — profissional_saude access is attributed with correct name and role", async () => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const { token: doctorToken } = await getDoctorToken(apiCtx);

  const anaId = await findPatientId(apiCtx, doctorToken, ANA_NAME);

  const accessResp = await apiCtx.get(`/api/patients/${anaId}`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  });
  expect(accessResp.ok()).toBeTruthy();

  const { scopedToken } = await getOwnerScopedToken(apiCtx);

  const logsResp = await apiCtx.get(`/api/clinics/me/access-logs?limit=50`, {
    headers: { Authorization: `Bearer ${scopedToken}` },
  });
  expect(logsResp.ok()).toBeTruthy();

  const logs = (await logsResp.json()) as Array<{
    id: number;
    accessorName: string;
    accessorRole: string;
    patientName: string;
    clinicId: number | null;
    fieldsAccessed: string[];
    accessedAt: string;
  }>;

  const entry = logs.find(
    (l) => l.accessorRole === "profissional_saude" && l.patientName === ANA_NAME
  );
  expect(entry, "profissional_saude entry for Ana Beatriz Costa not found").toBeDefined();
  expect(entry!.accessorName).toBe(DOCTOR_NAME);
  expect(entry!.clinicId).not.toBeNull();
  expect(entry!.fieldsAccessed.length).toBeGreaterThan(0);
  expect(new Date(entry!.accessedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);

  await apiCtx.dispose();
});

test("LGPD access log UI — Log de Acesso tab shows clinic_owner row in web admin", async ({ page }) => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const { scopedToken, userId, clinicId } = await getOwnerScopedToken(apiCtx);

  const nayaraId = await findPatientId(apiCtx, scopedToken, NAYARA_NAME);
  await apiCtx.get(`/api/patients/${nayaraId}`, {
    headers: { Authorization: `Bearer ${scopedToken}` },
  });
  await apiCtx.dispose();

  await page.goto("/");
  await page.evaluate(
    ({ tok, uid, cid, cname }) => {
      localStorage.setItem("clinic_web_token", tok);
      localStorage.setItem("clinic_web_user_id", String(uid));
      localStorage.setItem("clinic_web_clinic_id", String(cid));
      localStorage.setItem("clinic_web_clinic_name", cname);
    },
    { tok: scopedToken, uid: userId, cid: clinicId, cname: KLIE_NAME }
  );

  await page.goto("/lgpd");
  await expect(page.getByRole("tab", { name: /log de acesso/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: /log de acesso/i }).click();

  await expect(page.getByText(OWNER_NAME).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(NAYARA_NAME).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/clinic owner/i).first()).toBeVisible({ timeout: 5000 });
});

test("LGPD access log UI — Log de Acesso tab shows profissional_saude row with correct role label", async ({ page }) => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const { token: doctorToken } = await getDoctorToken(apiCtx);
  const anaId = await findPatientId(apiCtx, doctorToken, ANA_NAME);
  await apiCtx.get(`/api/patients/${anaId}`, {
    headers: { Authorization: `Bearer ${doctorToken}` },
  });

  const { scopedToken, userId, clinicId } = await getOwnerScopedToken(apiCtx);
  await apiCtx.dispose();

  await page.goto("/");
  await page.evaluate(
    ({ tok, uid, cid, cname }) => {
      localStorage.setItem("clinic_web_token", tok);
      localStorage.setItem("clinic_web_user_id", String(uid));
      localStorage.setItem("clinic_web_clinic_id", String(cid));
      localStorage.setItem("clinic_web_clinic_name", cname);
    },
    { tok: scopedToken, uid: userId, cid: clinicId, cname: KLIE_NAME }
  );

  await page.goto("/lgpd");
  await expect(page.getByRole("tab", { name: /log de acesso/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: /log de acesso/i }).click();

  await expect(page.getByText(DOCTOR_NAME).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(ANA_NAME).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/profissional saude/i).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/clinic_owner/i)).toHaveCount(0);
});

test("LGPD access log API — secretaria access is attributed with correct name and role", async () => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const { token: secretaryToken } = await getSecretaryToken(apiCtx);

  const anaId = await findPatientId(apiCtx, secretaryToken, ANA_NAME);

  const accessResp = await apiCtx.get(`/api/patients/${anaId}`, {
    headers: { Authorization: `Bearer ${secretaryToken}` },
  });
  expect(accessResp.ok()).toBeTruthy();

  const { scopedToken } = await getOwnerScopedToken(apiCtx);

  const logsResp = await apiCtx.get(`/api/clinics/me/access-logs?limit=50`, {
    headers: { Authorization: `Bearer ${scopedToken}` },
  });
  expect(logsResp.ok()).toBeTruthy();

  const logs = (await logsResp.json()) as Array<{
    id: number;
    accessorName: string;
    accessorRole: string;
    patientName: string;
    clinicId: number | null;
    fieldsAccessed: string[];
    accessedAt: string;
  }>;

  const entry = logs.find(
    (l) => l.accessorRole === "secretaria" && l.patientName === ANA_NAME
  );
  expect(entry, "secretaria entry for Ana Beatriz Costa not found").toBeDefined();
  expect(entry!.accessorName).toBe(SECRETARY_NAME);
  expect(entry!.clinicId).not.toBeNull();
  expect(entry!.fieldsAccessed.length).toBeGreaterThan(0);
  expect(new Date(entry!.accessedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);

  await apiCtx.dispose();
});

test("LGPD access log UI — Log de Acesso tab shows secretaria row with correct role label", async ({ page }) => {
  const apiCtx = await request.newContext({ baseURL: API_BASE });

  const { token: secretaryToken } = await getSecretaryToken(apiCtx);
  const anaId = await findPatientId(apiCtx, secretaryToken, ANA_NAME);
  await apiCtx.get(`/api/patients/${anaId}`, {
    headers: { Authorization: `Bearer ${secretaryToken}` },
  });

  const { scopedToken, userId, clinicId } = await getOwnerScopedToken(apiCtx);
  await apiCtx.dispose();

  await page.goto("/");
  await page.evaluate(
    ({ tok, uid, cid, cname }) => {
      localStorage.setItem("clinic_web_token", tok);
      localStorage.setItem("clinic_web_user_id", String(uid));
      localStorage.setItem("clinic_web_clinic_id", String(cid));
      localStorage.setItem("clinic_web_clinic_name", cname);
    },
    { tok: scopedToken, uid: userId, cid: clinicId, cname: KLIE_NAME }
  );

  await page.goto("/lgpd");
  await expect(page.getByRole("tab", { name: /log de acesso/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: /log de acesso/i }).click();

  await expect(page.getByText(SECRETARY_NAME).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(ANA_NAME).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/secretaria/i).first()).toBeVisible({ timeout: 5000 });
});
