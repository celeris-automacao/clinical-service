import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    // Sensitive fields that must never appear in logs
    "*.password",
    "*.passwordHash",
    "*.access_token",
    "*.accessToken",
    "*.token",
    "*.cpf",
    "*.rg",
    "*.tokenHash",
    "password",
    "passwordHash",
    "access_token",
    "accessToken",
    "token",
    "cpf",
    "rg",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
