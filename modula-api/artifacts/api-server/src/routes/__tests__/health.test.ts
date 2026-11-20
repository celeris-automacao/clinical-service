import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("@workspace/db", () => ({
  pool: {
    query: (...args: unknown[]) => queryMock(...args),
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import healthRouter from "../health";

function buildApp() {
  const app = express();
  app.use(healthRouter);
  return app;
}

describe("health routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockResolvedValue([{ "?column?": 1 }]);
  });

  it.each(["/healthz", "/health"])("returns a healthy payload on %s", async (path) => {
    const res = await request(buildApp()).get(path);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.version).toBeDefined();
    expect(res.body.environment).toBeDefined();
    expect(res.body.dependencies.database).toBe("ok");
  });

  it("returns ready=503 when the database probe fails", async () => {
    queryMock.mockRejectedValueOnce(new Error("db down"));

    const res = await request(buildApp()).get("/ready");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.dependencies.database).toBe("down");
  });

  it("returns ready=200 when the database probe succeeds", async () => {
    const res = await request(buildApp()).get("/ready");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.dependencies.database).toBe("ok");
  });
});
