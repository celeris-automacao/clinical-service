import { test, expect } from "@playwright/test";

const EXPO_DOMAIN = process.env.REPLIT_EXPO_DEV_DOMAIN ?? "";
const MOBILE_BASE = `https://${EXPO_DOMAIN}`;

test.use({
  viewport: { width: 400, height: 720 },
});

test("Profile screen dietary restrictions and reminders", async ({ page }) => {
  await page.goto(`${MOBILE_BASE}/auth`);
  await page.waitForSelector("input[placeholder='seu@email.com']", { timeout: 20000 });
  
  await page.getByPlaceholder("seu@email.com").fill("ana@paciente.dev");
  await page.getByPlaceholder("Sua senha de acesso").fill("123456");
  await page.getByText("Entrar", { exact: true }).last().click();

  await page.waitForURL((url) => !url.href.includes("/auth"), { timeout: 20000 });
  console.log("Logged in, URL:", page.url());

  if (page.url().includes("select-clinic")) {
      await page.locator("[role='button']").first().click();
      await page.getByText("Escolha para continuar", { exact: true }).click();
      await page.waitForURL((url) => !url.href.includes("select-clinic"), { timeout: 20000 });
  }

  // Use the tab bar link for Perfil
  const profileTab = page.locator('a:has-text("Perfil"), [role="link"]:has-text("Perfil")').first();
  await expect(profileTab).toBeVisible({ timeout: 15000 });
  await profileTab.click();

  await page.waitForURL((url) => url.href.includes("profile"), { timeout: 15000 });
  
  // Name might be inside a Text component which is a div in web
  const nameRegex = /Ana Beatriz Costa/i;
  await page.waitForSelector(`text=${nameRegex}`, { timeout: 20000 });
  await page.screenshot({ path: "profile-loaded.png" });

  // Open edit modal
  await page.getByText("Editar perfil").first().click();
  
  const dietaryInput = page.locator('[data-testid="profile-edit-modal-dietary-restrictions"]');
  await expect(dietaryInput).toBeVisible({ timeout: 10000 });
  
  await dietaryInput.fill("Sem lactose, low carb");
  await page.locator('[data-testid="profile-edit-modal-save"]').click();

  // Modal should close
  await expect(dietaryInput).not.toBeVisible({ timeout: 10000 });

  // Re-open and verify
  await page.getByText("Editar perfil").first().click();
  await expect(dietaryInput).toHaveValue("Sem lactose, low carb");
  await page.screenshot({ path: "dietary-restrictions-saved.png" });
  await page.locator('[data-testid="profile-edit-modal-close"]').click();

  // Notifications
  const notificationsText = page.getByText("Notificações");
  const isNotificationsVisible = await notificationsText.isVisible();
  console.log("Notifications visible:", isNotificationsVisible);
  if (isNotificationsVisible) {
      console.log("Notifications section visible.");
      await page.screenshot({ path: "notifications-section-visible.png" });
  } else {
      console.log("Notifications section NOT visible (as expected for web).");
      await page.screenshot({ path: "no-notifications-on-web.png" });
  }
});
