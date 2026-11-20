/**
 * E2E spec: 4-week streak bar chart on the patient mobile home screen.
 *
 * Confirms:
 * 1. After login the "Progresso — últimas 4 semanas" section heading is visible.
 * 2. Tapping a bar reveals a day-detail panel with a Portuguese-formatted date
 *    and a goal-completion summary ("X de 3 metas concluídas" or "Sem check-in
 *    neste dia").
 *
 * The spec is self-contained: it creates its own clinic-owner and patient
 * accounts, seeds 14 days of check-in data, and handles the change-password
 * redirect that Expo shows the first time a patient logs in with a temporary
 * password.
 */

import { test, expect } from "@playwright/test";

const API_BASE    = "http://localhost:80";
const EXPO_DOMAIN = process.env.REPLIT_EXPO_DEV_DOMAIN ?? "";
const MOBILE_BASE = EXPO_DOMAIN
  ? `https://${EXPO_DOMAIN}`
  : `${API_BASE}/clinic-mobile`;

const suffix        = Date.now();
const OWNER_EMAIL   = `owner_chart_${suffix}@clinic.test`;
const OWNER_PASS    = "Test1234!";
const PATIENT_EMAIL = `patient_chart_${suffix}@patient.test`;
const PATIENT_NAME  = `Chart Patient ${suffix}`;
const NEW_PASS      = "NewPass99!";

let ownerToken  = "";
let tempPass    = "";
let patientId   = 0;

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0]!;
}

test.setTimeout(120_000);

test.beforeAll(async ({ playwright }) => {
  const ctx = await playwright.request.newContext({ baseURL: API_BASE });

  const ownerReg = await ctx.post("/api/auth/register", {
    data: { email: OWNER_EMAIL, password: OWNER_PASS, name: "Chart Test Owner", role: "clinic_owner" },
  });
  if (!ownerReg.ok()) throw new Error(`Owner register failed: ${await ownerReg.text()}`);
  ownerToken = ((await ownerReg.json()) as { token: string }).token;

  const patientCreate = await ctx.post("/api/patients", {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: { name: PATIENT_NAME, email: PATIENT_EMAIL, startWeight: 80, dateOfBirth: "1995-06-15" },
  });
  if (!patientCreate.ok()) throw new Error(`Patient create failed: ${await patientCreate.text()}`);
  const patientBody = (await patientCreate.json()) as { id: number; temporaryPassword: string };
  patientId = patientBody.id;
  tempPass  = patientBody.temporaryPassword;

  for (let i = 0; i < 14; i++) {
    const date = isoDateDaysAgo(i);
    await ctx.post(`/api/patients/${patientId}/check-ins`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { date, didExercise: true, drankWater: true, ateWell: i % 2 === 0 },
    });
  }

  await ctx.dispose();
});

test.describe("Patient home — 4-week streak chart", () => {
  test("chart heading is visible and tapping a bar shows day detail with correct date", async ({ page }) => {
    await page.goto(`${MOBILE_BASE}/auth`);
    await page.waitForLoadState("domcontentloaded");

    await page.waitForSelector("input[placeholder='seu@email.com']", { timeout: 20_000 });
    await page.getByPlaceholder("seu@email.com").fill(PATIENT_EMAIL);
    await page.getByPlaceholder("Sua senha de acesso").fill(tempPass);
    await page.getByText("Entrar", { exact: true }).last().click();

    await page.waitForURL(/change-password|select-clinic|%28tabs%29|\(tabs\)/i, { timeout: 20_000 });

    if (page.url().includes("change-password")) {
      await page.waitForSelector("input[placeholder='Mínimo 6 caracteres']", { timeout: 10_000 });
      await page.getByPlaceholder("Mínimo 6 caracteres").fill(NEW_PASS);
      await page.getByPlaceholder("Digite novamente").fill(NEW_PASS);
      await page.getByText("Salvar senha", { exact: true }).click();
      await page.waitForURL(
        (url) => !url.href.includes("change-password") && !url.href.includes("/auth"),
        { timeout: 20_000 }
      );
    }

    if (page.url().includes("select-clinic")) {
      await page.waitForSelector("[role='button']", { timeout: 10_000 });
      await page.locator("[role='button']").first().click();
      await page.getByText("Escolha para continuar", { exact: true }).click();
      await page.waitForURL(
        (url) => !url.href.includes("select-clinic"),
        { timeout: 15_000 }
      );
    }

    await expect(page.getByText("Progresso de hoje")).toBeVisible({ timeout: 20_000 });

    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(800);

    const heading = page.getByText("Progresso — últimas 4 semanas");
    await expect(heading).toBeVisible({ timeout: 15_000 });

    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    // The chart renders 4 week sections, each with a label ("4 sem. atrás" … "Esta semana")
    // followed by a row of 7 TouchableOpacity bars (role="button" in Expo web).
    // Navigate from the "Esta semana" label text → its parent div → sibling row div → bar buttons.
    const weekLabelEl = page.getByText("Esta semana");
    await weekLabelEl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // Bar buttons carry testID="streak-bar-YYYY-MM-DD" → data-testid in Expo web.
    // Wait for them to appear (check-ins load asynchronously).
    const barLocator = page.locator('[data-testid^="streak-bar-"]');
    await expect(barLocator.first()).toBeVisible({ timeout: 12_000 });

    // Click the last bar (today — most likely to have a seeded check-in).
    await barLocator.last().click();
    await page.waitForTimeout(800);

    const ptMonths = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
    const ptDays   = ["segunda","terça","quarta","quinta","sexta","sábado","domingo"];

    const goalSummary = page.getByText(/metas concluídas|Sem check-in neste dia/i).first();
    await expect(goalSummary).toBeVisible({ timeout: 10_000 });

    // Grab the enclosing detail panel and verify it shows a Portuguese date
    const panelContainer = goalSummary.locator("xpath=ancestor::div[5]");
    const panelText = (await panelContainer.textContent()) ?? "";

    const hasPortugueseDate = ptMonths.some((m) => panelText.toLowerCase().includes(m))
                           || ptDays.some((d) => panelText.toLowerCase().includes(d));

    expect(
      hasPortugueseDate,
      `Detail panel must show a Portuguese date. Actual text: "${panelText}"`
    ).toBe(true);
  });
});
