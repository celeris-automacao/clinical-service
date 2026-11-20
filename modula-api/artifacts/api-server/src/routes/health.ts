import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function buildBaseHealth() {
  return {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version ?? "0.0.0",
    environment: process.env.NODE_ENV ?? "development",
    dependencies: {
      database: "unknown" as const,
    },
  };
}

async function checkDatabase(): Promise<"ok" | "down"> {
  try {
    await pool.query("select 1");
    return "ok";
  } catch (err) {
    logger.warn({ err }, "Health check database probe failed");
    return "down";
  }
}

router.get(["/healthz", "/health"], async (_req, res) => {
  const database = await checkDatabase();
  const data = {
    ...buildBaseHealth(),
    dependencies: { database },
  };

  res.status(200).json(data);
});

router.get("/ready", async (_req, res) => {
  const database = await checkDatabase();
  const ready = database === "ok";
  const data = {
    ...buildBaseHealth(),
    status: ready ? "ok" : "degraded",
    dependencies: { database },
  };

  res.status(ready ? 200 : 503).json(data);
});

export default router;
