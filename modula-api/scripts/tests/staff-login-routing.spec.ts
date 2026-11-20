/**
 * E2E spec: staff login routing on the mobile app (Expo web)
 *
 * Confirms three role-based routing paths:
 *
 *  A — profissional_saude lands on the staff Pacientes tab; "Clínica" is hidden.
 *  B — clinic_owner lands on the staff tabs with "Clínica" visible.
 *  C — patient is not routed to the staff tabs.
 *
 * Strategy
 * ────────
 * 1. API role check: verify the real login endpoint returns the right role for
 *    each seed user (lightweight integration assertion).
 *
 * 2. Expo routing via localStorage injection: pre-populate AsyncStorage (which
 *    maps to localStorage on Expo web) with a signed-in session so the app
 *    boots directly into the AuthContext.loadStoredAuth() path in
 *    context/AuthContext.tsx and the role-based Redirect in app/index.tsx —
 *    the same code that runs for returning users.
 *
 *    Because the Expo web app's API base URL points to the external Replit dev
 *    domain (not reachable from headless Chromium inside the container), we
 *    intercept ALL /api/ requests with page.route() and return minimal valid
 *    responses. This prevents the 401 → setOnUnauthorized → signOut cycle that
 *    would otherwise redirect back to the auth screen before we can verify tabs.
 *
 * Relevant source files:
 *   artifacts/clinic-mobile/context/AuthContext.tsx          – loadStoredAuth, signIn
 *   artifacts/clinic-mobile/app/index.tsx                    – role-based redirect
 *   artifacts/clinic-mobile/app/(staff-tabs)/_layout.tsx     – Clínica tab gating
 *   artifacts/clinic-mobile/app/auth.tsx                     – login + router.replace
 */

import { test, expect, request as apiRequest } from "@playwright/test";

const EXPO_BASE = "http://localhost:19383";
const API_BASE = "http://localhost:80";

// AsyncStorage on Expo web stores items in localStorage with these exact keys.
const TOKEN_KEY = "@clinic_auth_token";
const USER_ID_KEY = "@clinic_auth_user_id";
const ROLE_KEY = "@clinic_auth_role";

// ── API integration checks ────────────────────────────────────────────────────

test.describe("Login API — role verification", () => {
  const cases = [
    { email: "maria@gmail.com", expectedRole: "profissional_saude" },
    { email: "carlos@gmail.com", expectedRole: "clinic_owner" },
    { email: "eng.nayara@gmail.com", expectedRole: "patient" },
  ];

  for (const { email, expectedRole } of cases) {
    test(`POST /api/auth/login → ${email} returns role="${expectedRole}"`, async () => {
      const ctx = await apiRequest.newContext({ baseURL: API_BASE });
      const res = await ctx.post("/api/auth/login", {
        data: { email, password: "123456" },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.user.role).toBe(expectedRole);
      expect(typeof body.token).toBe("string");
      expect(body.token.length).toBeGreaterThan(0);
      await ctx.dispose();
    });
  }
});

// ── Expo routing tests ─────────────────────────────────────────────────────────

/**
 * Intercept all /api/ requests the Expo app makes (which go to the external
 * dev domain) and return minimal valid JSON so the UI can render without 401s.
 */
async function mockAllApiCalls(page: any) {
  // Match any URL that contains "/api/" (covers absolute external domain URLs)
  await page.route(/\/api\//, (route: any) => {
    const url = route.request().url();

    // Return empty-array responses for list endpoints, empty-object for others
    const isListEndpoint =
      url.includes("/patients") ||
      url.includes("/doctors") ||
      url.includes("/summaries") ||
      url.includes("/checkins") ||
      url.includes("/activities");

    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isListEndpoint ? [] : {}),
    });
  });
}

/**
 * Pre-populate localStorage (AsyncStorage on web) so the app boots as if the
 * user is already signed in with the given role.
 */
async function bootAsRole(page: any, role: string, userId = "1") {
  await page.addInitScript(
    ({ token, uid, r, tk, uk, rk }: Record<string, string>) => {
      localStorage.setItem(tk, token);
      localStorage.setItem(uk, uid);
      localStorage.setItem(rk, r);
    },
    {
      token: `fake_jwt_${role}`,
      uid: userId,
      r: role,
      tk: TOKEN_KEY,
      uk: USER_ID_KEY,
      rk: ROLE_KEY,
    }
  );

  await mockAllApiCalls(page);
  await page.goto(EXPO_BASE + "/");
}

test.describe("Mobile staff routing (Expo web — localStorage + API mock)", () => {
  test(
    "A — profissional_saude is redirected to staff tabs; Clínica tab is hidden",
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      await bootAsRole(page, "profissional_saude", "2");

      // index.tsx: role=profissional_saude → Redirect href="/(staff-tabs)/patients"
      // On Expo web, route groups are transparent: the URL becomes /patients.
      await page.waitForURL(/\/patients/, { timeout: 20_000 });

      // Staff tab bar (tabBarPosition="top" on web) must contain these labels
      await expect(page.getByText("Pacientes").first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText("Resumos").first()).toBeVisible({
        timeout: 10_000,
      });

      // "Clínica" must be HIDDEN for profissional_saude
      // (staff-tabs/_layout.tsx: tabBarButton: isOwner ? undefined : () => null)
      const clinicaCount = await page.getByText("Clínica").count();
      for (let i = 0; i < clinicaCount; i++) {
        await expect(page.getByText("Clínica").nth(i)).not.toBeVisible();
      }

      // Must NOT show patient-only navigation labels
      await expect(page.getByText("Registro").first()).not.toBeVisible();

      await ctx.close();
    }
  );

  test(
    "B — clinic_owner is redirected to staff tabs and sees the Clínica tab",
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      await bootAsRole(page, "clinic_owner", "1");

      await page.waitForURL(/\/patients/, { timeout: 20_000 });

      await expect(page.getByText("Pacientes").first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText("Resumos").first()).toBeVisible({
        timeout: 10_000,
      });

      // "Clínica" IS visible for clinic_owner
      await expect(page.getByText("Clínica").first()).toBeVisible({
        timeout: 10_000,
      });

      await ctx.close();
    }
  );

  test(
    "C — patient is redirected to patient flow, not staff tabs",
    async ({ browser }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      await bootAsRole(page, "patient", "3");

      // Patient → index.tsx does Redirect href="/(tabs)"
      // The URL must NOT contain (staff-tabs)
      await page.waitForURL(
        (url) => !url.pathname.includes("(staff-tabs)"),
        { timeout: 20_000 }
      );

      await page.waitForTimeout(2_000);

      const url = page.url();
      expect(url).not.toContain("staff-tabs");

      // Staff-only tab label "Resumos" must not be visible in the patient flow
      const resumosVisible = await page
        .getByText("Resumos")
        .first()
        .isVisible()
        .catch(() => false);
      expect(resumosVisible).toBe(false);

      await ctx.close();
    }
  );
});
