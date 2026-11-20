import { test, expect } from "@playwright/test";

const CLINIC_OWNER_EMAIL = "admin@clinica.dev";
const CLINIC_OWNER_PASSWORD = "senha123";

const PATIENTS = [
  {
    name: "Ana Beatriz Costa",
    materials: [
      "Receita — Ozempic 0.5mg",
      "Cardápio Semana 1",
      "Diário Alimentar",
      "Exercícios para iniciantes",
    ],
  },
  {
    name: "Bruno Oliveira",
    materials: [
      "Receita — Metformina 500mg",
      "Cardápio Masculino — 1800 kcal",
      "Técnicas Anti-Ansiedade",
      "Como ler rótulos nutricionais",
    ],
  },
  {
    name: "Cláudia Martins",
    materials: [
      "Escala de Fome e Saciedade",
      "Cardápio Plant-Based — 1600 kcal",
      "Psicologia do emagrecimento",
      "Suplemento — Whey Protein",
    ],
  },
];

test.describe("Seed patients — Materiais tab (clinic owner view)", () => {
  for (const { name, materials } of PATIENTS) {
    test(`${name} — 4 seed materials appear on Materiais tab`, async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector("input[placeholder='seu@email.com']");
      await page.getByPlaceholder("seu@email.com").fill(CLINIC_OWNER_EMAIL);
      await page.getByPlaceholder("Digite sua senha").fill(CLINIC_OWNER_PASSWORD);
      await page.getByRole("button", { name: /entrar/i }).click();

      await page.waitForURL(/\/(dashboard|patients)/, { timeout: 15_000 });

      await page.goto("/patients");
      await page.waitForLoadState("networkidle");

      const patientLink = page.getByText(new RegExp(name, "i")).first();
      await expect(patientLink).toBeVisible({ timeout: 15_000 });
      await patientLink.click();

      await page.waitForURL(/\/patients\/\d+/, { timeout: 10_000 });

      await page.getByRole("tab", { name: /^materiais$/i }).click();

      const tabPanel = page.getByRole("tabpanel");
      await expect(tabPanel).toBeVisible({ timeout: 10_000 });

      for (const title of materials) {
        await expect(tabPanel.getByText(title)).toBeVisible({ timeout: 10_000 });
      }

      await expect(tabPanel.getByText(/nenhum material/i)).not.toBeVisible();
    });
  }
});
