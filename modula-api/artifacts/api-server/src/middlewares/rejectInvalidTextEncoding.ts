import type { Request, RequestHandler } from "express";
import { logger } from "../lib/logger";

function containsReplacementCharacter(value: unknown): boolean {
  if (typeof value === "string") return value.includes("\uFFFD");
  if (Array.isArray(value)) return value.some(containsReplacementCharacter);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(
      ([key, entry]) => key.includes("\uFFFD") || containsReplacementCharacter(entry),
    );
  }
  return false;
}

function hasInvalidTextEncoding(req: Request): boolean {
  return containsReplacementCharacter(req.body) || containsReplacementCharacter(req.query);
}

export const rejectInvalidTextEncoding: RequestHandler = (req, res, next) => {
  if (!hasInvalidTextEncoding(req)) {
    next();
    return;
  }

  logger.warn({ method: req.method, path: req.path }, "Request rejected due to invalid UTF-8 text");
  res.status(400).json({
    error: "O texto enviado contém caracteres inválidos. Revise a codificação e tente novamente.",
  });
};
