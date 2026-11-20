import request from "supertest";
import { Router } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clerkMiddlewareMock = vi.fn(() => (_req: any, _res: any, next: any) => next());
const loggerWarnMock = vi.fn();
const dbQueryMock = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
const loggerMock = {
  levels: { values: { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } },
  warn: loggerWarnMock,
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => loggerMock),
};

async function importAppWithEnv(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.clearAllMocks();

  delete process.env.CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.NODE_ENV;

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  vi.doMock("@clerk/express", () => ({
    clerkMiddleware: clerkMiddlewareMock,
    getAuth: vi.fn(() => ({ userId: null })),
  }));
  vi.doMock("@clerk/shared/keys", () => ({
    publishableKeyFromHost: vi.fn((_host: string, key?: string) => key),
  }));
  vi.doMock("@workspace/db", () => ({
    pool: {
      query: dbQueryMock,
    },
  }));
  vi.doMock("../routes", () => ({
    default: Router(),
  }));
  vi.doMock("../lib/logger", () => ({
    logger: loggerMock,
  }));

  return (await import("../app")).default;
}

describe("app Clerk configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    dbQueryMock.mockResolvedValue([{ "?column?": 1 }]);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does not mount Clerk in production when no Clerk variables are configured", async () => {
    const app = await importAppWithEnv({ NODE_ENV: "production" });

    const res = await request(app).get("/api/healthz");

    expect(res.status).toBe(200);
    expect(clerkMiddlewareMock).not.toHaveBeenCalled();
  });

  it("keeps Clerk disabled and logs a warning for partial configuration", async () => {
    const app = await importAppWithEnv({
      NODE_ENV: "production",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
    });

    const res = await request(app).get("/api/healthz");

    expect(res.status).toBe(200);
    expect(clerkMiddlewareMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      { hasPublishableKey: true, hasSecretKey: false },
      "Clerk configuration incomplete; Clerk integration disabled"
    );
  });

  it("mounts Clerk when publishable and secret keys are both configured", async () => {
    const app = await importAppWithEnv({
      NODE_ENV: "production",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
    });

    const res = await request(app).get("/api/healthz");

    expect(res.status).toBe(200);
    expect(clerkMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("allows the local IPv4 loopback origin in development with an explicit allowlist", async () => {
    const app = await importAppWithEnv({
      NODE_ENV: "development",
      ALLOWED_ORIGINS: "https://staging.example.com",
    });

    const res = await request(app)
      .options("/api/auth/login")
      .set("Origin", "http://127.0.0.1:5177")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5177");
  });
});
