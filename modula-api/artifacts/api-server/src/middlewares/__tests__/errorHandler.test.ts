import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { apiErrorHandler, notFoundHandler, ApiError } from "../errorHandler";

describe("error handlers", () => {
  it("returns a normalized 404 response", async () => {
    const app = express();
    app.get("/boom", (_req, _res, next) => next());
    app.use(notFoundHandler);
    app.use(apiErrorHandler);

    const res = await request(app).get("/missing");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
    expect(res.body.error.message).toBe("Rota não encontrada");
  });

  it("preserves explicit ApiError status and code", async () => {
    const app = express();
    app.get("/boom", (_req, _res, next) => {
      next(new ApiError(409, "conflict", "Conflito detectado"));
    });
    app.use(apiErrorHandler);

    const res = await request(app).get("/boom");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("conflict");
    expect(res.body.error.message).toBe("Conflito detectado");
  });
});
