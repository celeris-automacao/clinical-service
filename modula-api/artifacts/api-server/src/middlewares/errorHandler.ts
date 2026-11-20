import { type ErrorRequestHandler, type RequestHandler } from "express";
import { logger } from "../lib/logger";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function toApiError(
  err: unknown
): { status: number; code: string; message: string; details?: unknown } {
  if (err instanceof ApiError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }

  if (err && typeof err === "object" && "status" in err && "message" in err) {
    const status = Number((err as { status?: unknown }).status);
    if (Number.isFinite(status) && status >= 400) {
      return {
        status,
        code: "http_error",
        message: String((err as { message?: unknown }).message ?? "Error"),
      };
    }
  }

  return {
    status: 500,
    code: "internal_server_error",
    message: "Erro interno do servidor",
  };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: "not_found",
      message: "Rota não encontrada",
      requestId: req.id,
    },
  });
};

export const apiErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const apiError = toApiError(err);
  logger.error(
    {
      err,
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: apiError.status,
      code: apiError.code,
    },
    "API request failed"
  );

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId: req.id,
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
    },
  });
};
