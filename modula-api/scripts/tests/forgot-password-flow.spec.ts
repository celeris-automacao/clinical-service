/**
 * E2E spec: forgot-password / recovery flow on the Expo web app.
 *
 * Confirms the complete user journey:
 *
 *  A — From /auth, tapping "Esqueci minha senha" with a pre-typed email
 *      navigates to the recovery screen with the email pre-filled and
 *      "Recuperar senha 🔑" as the title.
 *
 *  B — Submitting the recovery form shows the success modal ("Senha enviada!").
 *
 *  C — Tapping "OK, ir para o login" in the success modal returns to /auth.
 *
 *  D — The unaffected "Já tenho uma senha? Entrar" path on /welcome (without
 *      recovery mode) still navigates to /auth.
 *
 * Strategy
 * ────────
 * 1. Start from the unauthenticated /auth screen — no localStorage injection
 *    is needed because we are testing the login bypass paths.
 *
 * 2. Intercept POST /api/auth/request-access and return a 200 OK stub so the
 *    success modal fires without requiring a real seeded email or mail delivery.
 *
 * Relevant source files:
 *   artifacts/clinic-mobile/app/auth.tsx     – "Esqueci minha senha" button → router.push
 *   artifacts/clinic-mobile/app/welcome.tsx  – recovery/first-access screen + modal
 */

import { test, expect } from "@playwright/test";

const EXPO_BASE = "http://localhost:19383";

// ── Helper: intercept the request-access mutation ─────────────────────────────

/**
 * Stub POST /api/auth/request-access so the Expo app's useMutation resolves
 * successfully without hitting the real database or mail transport.
 */
async function mockRequestAccess(page: any) {
  await page.route(/\/api\/auth\/request-access/, (route: any) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok" }),
    });
  });
}

/**
 * Intercept all other /api/ calls (branding, clinics, etc.) so they don't
 * cause console noise or 401-triggered sign-outs on an unauthenticated visit.
 */
async function stubBackgroundApiCalls(page: any) {
  await page.route(/\/api\/(?!auth\/request-access)/, (route: any) => {
    const url = route.request().url();
    const isListEndpoint =
      url.includes("/clinics") ||
      url.includes("/patients") ||
      url.includes("/branding");
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isListEndpoint ? [] : {}),
    });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Forgot-password / recovery flow (Expo web)", () => {
  test(
    'A+B+C — "Esqueci minha senha" → recovery screen → success modal → back to /auth',
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      await stubBackgroundApiCalls(page);
      await mockRequestAccess(page);

      // 1. Land on the login screen
      await page.goto(EXPO_BASE + "/auth");

      // Confirm we are on the login form (not a different artifact)
      await expect(page.getByText("Esqueci minha senha").first()).toBeVisible({
        timeout: 20_000,
      });

      // 2. Type an email in the login form's email field
      const emailInput = page.getByPlaceholder("seu@email.com").first();
      await emailInput.fill("paciente@test.com");

      // 3. Tap "Esqueci minha senha" — should navigate to /welcome?mode=recovery&email=...
      await page.getByText("Esqueci minha senha").first().click();

      // 4. Verify we are on the recovery screen
      await expect(page.getByText("Recuperar senha 🔑")).toBeVisible({
        timeout: 15_000,
      });

      // 5. The email input should be pre-filled from the URL param
      const recoveryEmailInput = page.getByPlaceholder("seu@email.com").first();
      await expect(recoveryEmailInput).toHaveValue("paciente@test.com", {
        timeout: 5_000,
      });

      // 6. Submit the recovery form
      await page.getByText("Enviar senha temporária").click();

      // 7. Success modal appears
      await expect(page.getByText("Senha enviada!")).toBeVisible({
        timeout: 10_000,
      });

      // 8. Tap "OK, ir para o login" in the modal
      await page.getByText("OK, ir para o login").click();

      // 9. Wait for navigation back to /auth (router.replace("/auth"))
      await page.waitForURL(/\/auth/, { timeout: 15_000 });

      // Confirm the /auth screen content is in the DOM.
      // Note: React Native web renders inside overflow:hidden flex containers, so
      // toBeVisible() can report "hidden" for elements that are actually rendered
      // and reachable. Using toBeAttached() (DOM presence) is the correct check here.
      await expect(page.getByText("Acessar minha conta").first()).toBeAttached({
        timeout: 10_000,
      });
      // The recovery modal/screen must no longer be shown
      await expect(page.getByText("Senha enviada!")).not.toBeAttached();

      await ctx.close();
    }
  );

  test(
    'D — /welcome without mode param shows "Já tenho uma senha? Entrar" which returns to /auth',
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      await stubBackgroundApiCalls(page);

      // Navigate directly to /welcome (first-access mode, no mode param)
      await page.goto(EXPO_BASE + "/welcome");

      // Should show the first-access title, not the recovery title
      await expect(page.getByText("Bem-vindo(a)! 👋")).toBeVisible({
        timeout: 20_000,
      });

      // "Recuperar senha" must NOT be visible
      await expect(page.getByText("Recuperar senha 🔑")).not.toBeVisible();

      // The "Já tenho uma senha? Entrar" link must be visible
      await expect(
        page.getByText("Já tenho uma senha? Entrar")
      ).toBeVisible({ timeout: 5_000 });

      // Tapping the link navigates to /auth (login form appears)
      await page.getByText("Já tenho uma senha? Entrar").click();

      await expect(page.getByText("Esqueci minha senha")).toBeVisible({
        timeout: 15_000,
      });

      await ctx.close();
    }
  );
});
