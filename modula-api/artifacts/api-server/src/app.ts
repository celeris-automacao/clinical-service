import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";
import { isClerkConfigured, isClerkPartiallyConfigured } from "./lib/clerkConfig";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { apiErrorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { rejectInvalidTextEncoding } from "./middlewares/rejectInvalidTextEncoding";

const app: Express = express();

// Trust the first proxy hop (Replit's reverse proxy forwards X-Forwarded-For).
// Required for express-rate-limit to correctly identify client IPs.
app.set("trust proxy", 1);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// ── CORS — locked to known origins ──────────────────────────────────────────
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS ?? "";
const replitDomain = process.env.REPLIT_DEV_DOMAIN;
const defaultAllowed = replitDomain
  ? [`https://${replitDomain}`]
  : [];

const allowedOrigins: string[] = allowedOriginsEnv
  ? allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean)
  : defaultAllowed;

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow server-to-server calls (no Origin header)
      if (!origin) return callback(null, true);
      // In development with no configured origins, allow all
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow *.replit.dev and *.repl.co subdomains in dev
      if (
        process.env.NODE_ENV !== "production" &&
        (/\.replit\.dev$/.test(origin) ||
          /\.repl\.co$/.test(origin) ||
          origin === "http://localhost:80" ||
          origin.startsWith("http://localhost:") ||
          origin === "http://127.0.0.1" ||
          origin.startsWith("http://127.0.0.1:"))
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);

// ── Rate limiting ────────────────────────────────────────────────────────────
// Strict limiter for auth endpoints: 10 req/min per IP
const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde 1 minuto e tente novamente." },
  handler: (req, res, _next, options) => {
    logger.warn(
      { ip: req.ip, path: req.path },
      "Rate limit exceeded on auth endpoint"
    );
    res.status(options.statusCode).json(options.message);
  },
});

// General API limiter: 200 req/min per IP
const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde 1 minuto." },
});

// ── Request logging ─────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const clerkConfigured = isClerkConfigured();

if (isClerkPartiallyConfigured()) {
  logger.warn(
    {
      hasPublishableKey: Boolean(process.env.CLERK_PUBLISHABLE_KEY),
      hasSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
    },
    "Clerk configuration incomplete; Clerk integration disabled"
  );
}

if (clerkConfigured) {
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
}

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rejectInvalidTextEncoding);

app.use("/api", healthRouter);

if (clerkConfigured) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

// Apply rate limiters
app.use(
  /^\/api\/auth\/(login|register|request-reset|reset-password|forgot-password|request-access|resend-access)/,
  authRateLimiter
);
app.use("/api", generalRateLimiter);

app.use("/api", router);
app.use(notFoundHandler);
app.use(apiErrorHandler);

export default app;
