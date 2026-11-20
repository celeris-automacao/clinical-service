import path from "path";
import { fileURLToPath } from "url";
import app from "./app";
import { logger } from "./lib/logger";
import { startBirthdayJob } from "./lib/birthdayJob";
import { startAppointmentReminderJob } from "./lib/appointmentReminderJob";
import { startRateLimitCleanupJob } from "./lib/rateLimitCleanupJob";
import { startTempPasswordExpiryJob } from "./lib/tempPasswordExpiryJob";
import { startAuditFailureSweepJob } from "./lib/auditFailureSweepJob";
import { migrateDb } from "@workspace/db/migrate";
import { usesDiskStorage, validateDiskStorage } from "./lib/diskStorage";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Resolve the migrations folder relative to this file's location.
// Works for both dev (tsx src/index.ts) and production (node dist/index.mjs)
// because both sit exactly 3 levels below the workspace root.
const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../lib/db/migrations",
);

async function main() {
  if (usesDiskStorage()) await validateDiskStorage();
  try {
    await migrateDb(migrationsFolder);
  } catch (err) {
    logger.error({ err }, "Database migration failed — aborting startup");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startBirthdayJob();
    startAppointmentReminderJob();
    startRateLimitCleanupJob();
    startTempPasswordExpiryJob();
    startAuditFailureSweepJob();
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, "Unhandled error during server startup");
  process.exit(1);
});
