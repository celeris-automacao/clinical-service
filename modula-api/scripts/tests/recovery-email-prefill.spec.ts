/**
 * E2E spec: "Esqueci minha senha" recovery link pre-fills email on welcome screen
 *
 * Flow confirmed:
 *   1. Patient opens the web login panel (/auth — Platform.OS === "web" branch)
 *   2. Types an email into the email field
 *   3. Clicks "Esqueci minha senha"
 *   4. Is navigated to /welcome?mode=recovery&email=<encoded>
 *   5. The email field on the welcome screen is pre-filled with the typed value
 *
 * Implementation notes:
 *   - auth.tsx (line ~350): builds the URL via encodeURIComponent and calls router.push
 *   - welcome.tsx: reads useLocalSearchParams() → seeds useState(params.email ?? "")
 *
 * The Expo app runs on its own dedicated domain (separate from the shared reverse
 * proxy). EXPO_BASE uses the local dev port (19383); the e2e test suite should be
 * run inside the container where this port is reachable.
 *
 * API calls from the Expo app target the external dev domain (CORS-blocked in
 * headless Chromium). We intercept /api/ requests and return minimal stubs so
 * the app renders without 401 → sign-out loops.
 */

import { test, expect } from "@playwright/test";

const EXPO_BASE = "http://localhost:19383";

/**
 * Intercept all outbound /api/ fetches from the Expo app so that CORS and
 * network errors do not trigger the unauthenticated-redirect cycle.
 */
async function stubApiCalls(page: any) {
  await page.route(/\/api\//, (route: any) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

test.describe("Recovery link — email pre-fill on welcome screen (Expo web)", () => {
  test(
    "types email, clicks Esqueci minha senha, and sees it pre-filled on /welcome",
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      await stubApiCalls(page);

      // ── Step 1: open the login screen ──────────────────────────────────────
      await page.goto(`${EXPO_BASE}/auth`, { waitUntil: "domcontentloaded" });

      // Wait for the login form to appear
      await expect(page.getByText("Acessar minha conta")).toBeVisible({
        timeout: 20_000,
      });

      // ── Step 2: type an email ───────────────────────────────────────────────
      const emailInput = page.getByPlaceholder("seu@email.com");
      await emailInput.fill("paciente@example.com");

      // ── Step 3: click the recovery link ────────────────────────────────────
      await page.getByText("Esqueci minha senha").click();

      // ── Step 4: URL must contain mode=recovery and the encoded email ────────
      await page.waitForURL(
        (url) =>
          url.pathname.includes("welcome") &&
          url.search.includes("mode=recovery") &&
          url.search.includes("email="),
        { timeout: 15_000 }
      );

      const currentUrl = new URL(page.url());
      expect(currentUrl.searchParams.get("mode")).toBe("recovery");
      // The @ in the email is percent-encoded; decoding gives the original value
      const emailParam = currentUrl.searchParams.get("email");
      expect(emailParam).toBe("paciente@example.com");

      // ── Step 5: welcome screen shows recovery mode and pre-filled email ─────
      await expect(page.getByText("Recuperar senha 🔑")).toBeVisible({
        timeout: 10_000,
      });

      // The email TextInput on welcome.tsx renders with value={email} (seeded
      // from params.email). On Expo web, a TextInput renders as an <input>.
      const welcomeEmailInput = page.locator("input").filter({
        hasText: "",
      });
      // Prefer the more targeted query: find the input whose value equals the email
      const inputs = page.locator("input");
      const count = await inputs.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const val = await inputs.nth(i).inputValue();
        if (val === "paciente@example.com") {
          found = true;
          break;
        }
      }
      expect(found, "Email input on /welcome should be pre-filled with 'paciente@example.com'").toBe(true);

      // Recovery mode button text
      await expect(page.getByText("Enviar senha temporária")).toBeVisible({
        timeout: 5_000,
      });

      await ctx.close();
    }
  );

  test(
    "empty email field produces /welcome?mode=recovery with no email param",
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      await stubApiCalls(page);

      await page.goto(`${EXPO_BASE}/auth`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Acessar minha conta")).toBeVisible({
        timeout: 20_000,
      });

      // Do NOT type anything — click the link with an empty email field
      await page.getByText("Esqueci minha senha").click();

      await page.waitForURL(
        (url) =>
          url.pathname.includes("welcome") &&
          url.search.includes("mode=recovery"),
        { timeout: 15_000 }
      );

      const currentUrl = new URL(page.url());
      expect(currentUrl.searchParams.get("mode")).toBe("recovery");
      // No email param expected
      expect(currentUrl.searchParams.get("email")).toBeNull();

      // Welcome screen still shows recovery UI
      await expect(page.getByText("Recuperar senha 🔑")).toBeVisible({
        timeout: 10_000,
      });

      await ctx.close();
    }
  );
});
