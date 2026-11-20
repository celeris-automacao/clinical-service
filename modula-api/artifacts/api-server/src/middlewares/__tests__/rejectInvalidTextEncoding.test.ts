import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { logger } from "../../lib/logger";
import { rejectInvalidTextEncoding } from "../rejectInvalidTextEncoding";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(rejectInvalidTextEncoding);
  app.post("/text", (req, res) => res.json({ accepted: req.body }));
  app.get("/text", (req, res) => res.json({ accepted: req.query }));
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rejectInvalidTextEncoding", () => {
  it("accepts valid UTF-8 Portuguese text", async () => {
    const response = await request(buildApp()).post("/text").send({
      name: "Clínica São João - Coração Íris",
      message: "Solicitação recebida.",
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/charset=utf-8/i);
    expect(response.body.accepted.name).toBe("Clínica São João - Coração Íris");
  });

  it("rejects replacement characters in nested request data", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    const response = await request(buildApp()).post("/text").send({
      lead: { notes: "Solicita��o de demonstração" },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("caracteres inválidos");
    expect(warn).toHaveBeenCalledWith(
      { method: "POST", path: "/text" },
      "Request rejected due to invalid UTF-8 text",
    );
  });

  it("rejects replacement characters in query input", async () => {
    const response = await request(buildApp()).get("/text").query({ search: "Sa�de" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("caracteres inválidos");
  });
});
