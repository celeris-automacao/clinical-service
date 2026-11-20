import { test, expect } from "@playwright/test";

const CLINIC_STAFF_EMAIL = "ligia@clinica.dev";
const CLINIC_STAFF_PASSWORD = "senha123";
const PATIENT_NAME = "Nayara Engel";

const EXPECTED_MATERIALS = [
  "Receita — Saxenda 0.6mg",
  "Cardápio Engenheira — 1500 kcal",
  "Guia de Lanches Saudáveis",
  "Treino HIIT 20 minutos",
];

test.describe("Nayara Engel — Materiais tab", () => {
  test("seed materials (prescription, meal_plan, pdf, video) appear on patient detail page", async ({ page }) => {
    await page.goto("/login");

    await page.waitForSelector("input[placeholder='seu@email.com']");
    await page.getByPlaceholder("seu@email.com").fill(CLINIC_STAFF_EMAIL);
    await page.getByPlaceholder("Digite sua senha").fill(CLINIC_STAFF_PASSWORD);
    await page.getByRole("button", { name: /entrar/i }).click();

    await page.waitForURL(/\/(dashboard|patients)/, { timeout: 15_000 });

    await page.goto("/patients");
    await page.waitForLoadState("networkidle");

    const nayaraLink = page.getByText(new RegExp(PATIENT_NAME, "i")).first();
    await expect(nayaraLink).toBeVisible({ timeout: 15_000 });
    await nayaraLink.click();

    await page.waitForURL(/\/patients\/\d+/, { timeout: 10_000 });

    await page.getByRole("tab", { name: /^materiais$/i }).click();

    const tabPanel = page.getByRole("tabpanel");
    await expect(tabPanel).toBeVisible({ timeout: 10_000 });

    for (const title of EXPECTED_MATERIALS) {
      await expect(tabPanel.getByText(title)).toBeVisible({ timeout: 10_000 });
    }

    await expect(tabPanel.getByText(/nenhum material/i)).not.toBeVisible();
  });
});
