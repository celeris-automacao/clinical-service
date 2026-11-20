import { raw, Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, carePackagePromotionUploadsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth, isError, resolveCallerClinicId } from "../lib/auth-helpers";
import { canReadStorageObject, isValidStorageObjectPath } from "../lib/storage-access";
import { matchesUploadType, readStorageTicket, saveDiskObject, usesDiskStorage } from "../lib/diskStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.put("/storage/disk-upload", raw({ type: () => true, limit: "10mb" }), async (req, res): Promise<void> => {
  if (!usesDiskStorage()) { res.status(404).json({ error: "Not found" }); return; }
  const ticket = readStorageTicket(req.query.ticket, "PUT");
  if (!ticket) { res.status(403).json({ error: "Invalid or expired upload URL" }); return; }
  const contentType = req.get("content-type")?.split(";")[0];
  if (!contentType || !Buffer.isBuffer(req.body) || req.body.length !== ticket.size || contentType !== ticket.contentType
    || !matchesUploadType(req.body, contentType)) {
    res.status(400).json({ error: "File size or format does not match the authorized upload." });
    return;
  }
  try {
    await saveDiskObject(ticket.path, req.body, contentType);
    res.status(201).end();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      res.status(409).json({ error: "Upload URL already used." });
      return;
    }
    req.log.error({ err: error }, "Failed to write private disk object");
    res.status(500).json({ error: "Failed to save file." });
  }
});

router.get("/storage/disk-read", async (req, res): Promise<void> => {
  if (!usesDiskStorage()) { res.status(404).json({ error: "Not found" }); return; }
  const ticket = readStorageTicket(req.query.ticket, "GET");
  if (!ticket) { res.status(403).json({ error: "Invalid or expired file URL" }); return; }
  try {
    const file = await objectStorageService.getObjectEntityFile(ticket.path);
    const response = await objectStorageService.downloadObject(file);
    res.set({ "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox", "X-Content-Type-Options": "nosniff" });
    res.type(response.headers.get("content-type") ?? "application/octet-stream");
    if (response.body) {
      const stream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      stream.on("error", (error) => {
        req.log.error({ err: error }, "Failed to stream private disk object");
        res.destroy(error);
      });
      stream.pipe(res);
    } else res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Object not found" }); return; }
    req.log.error({ err: error }, "Failed to read private disk object");
    res.status(500).json({ error: "Failed to read file." });
  }
});

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Authenticated: only logged-in users may request upload URLs.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { size, contentType } = parsed.data;
    if (!Number.isSafeInteger(size) || size <= 0 || size > 10 * 1024 * 1024
      || !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(contentType)) {
      res.status(400).json({ error: "Use JPG, PNG, WEBP ou PDF de até 10 MB." });
      return;
    }
    let promotionClinicId: number | null = null;
    if (parsed.data.purpose === "care-package-promotion") {
      if (
        !["clinic_owner", "secretaria"].includes(authResult.user.role) ||
        !["image/png", "image/jpeg", "image/webp"].includes(contentType)
      ) {
        res.status(403).json({ error: "Este tipo de imagem só pode ser enviado pela equipe da clínica." });
        return;
      }
      promotionClinicId = await resolveCallerClinicId(authResult.user, authResult.clinicId);
      if (!promotionClinicId) {
        res.status(403).json({ error: "Usuário não vinculado a uma clínica." });
        return;
      }
    }
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL({ size, contentType });
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
    if (promotionClinicId) {
      await db.insert(carePackagePromotionUploadsTable).values({
        objectPath,
        clinicId: promotionClinicId,
        uploadedByUserId: authResult.user.id,
        contentType,
      });
    }

    res.json(
      RequestUploadUrlResponse.parse({
        uploadUrl,
        objectPath,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

router.get("/storage/objects/sign", async (req: Request, res: Response) => {
  const path = req.query.path;
  if (typeof path !== "string" || !isValidStorageObjectPath(path)) {
    res.status(400).json({ error: "Invalid object path" });
    return;
  }

  try {
    const authResult = await requireAuth(req);
    const user = isError(authResult) ? null : authResult.user;
    const clinicId = isError(authResult) ? undefined : authResult.clinicId;
    if (isError(authResult) && !(await canReadStorageObject(path, null))) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }
    if (!(await canReadStorageObject(path, user, clinicId))) {
      res.status(user ? 403 : 401).json({ error: user ? "Forbidden" : "Unauthorized" });
      return;
    }

    const url = await objectStorageService.getObjectEntityReadURL(path);
    res.json({ url, expiresInSeconds: 300 });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error signing object URL");
    res.status(500).json({ error: "Failed to sign object URL" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * Authentication and resource authorization are required except for assets
 * attached to a published public clinic page.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    if (!isValidStorageObjectPath(objectPath)) {
      res.status(400).json({ error: "Invalid object path" });
      return;
    }
    const authResult = await requireAuth(req);
    const user = isError(authResult) ? null : authResult.user;
    const clinicId = isError(authResult) ? undefined : authResult.clinicId;
    if (isError(authResult) && !(await canReadStorageObject(objectPath, null))) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }
    if (!(await canReadStorageObject(objectPath, user, clinicId))) {
      res.status(user ? 403 : 401).json({ error: user ? "Forbidden" : "Unauthorized" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
