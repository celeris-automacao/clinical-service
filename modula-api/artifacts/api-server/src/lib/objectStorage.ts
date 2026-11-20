import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { createStorageTicket, DiskObject, isMissingDiskObject, readStorageTicket, saveDiskObject, usesDiskStorage } from "./diskStorage";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    if (usesDiskStorage()) return null;
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Kept short (5 min) rather than the previous 1h so that any client/proxy
  // cache layer that ignores the fact that uploads always get a brand-new
  // objectPath (see getObjectEntityUploadURL) still converges quickly —
  // avatars and other private objects were reported as staying visibly
  // stale for up to an hour in some client caches.
  async downloadObject(file: File | DiskObject, cacheTtlSec: number = 300): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = file instanceof DiskObject ? null : await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": file instanceof DiskObject ? "private, no-store" : `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (file instanceof DiskObject) {
      headers["Content-Security-Policy"] = "sandbox";
      headers["X-Content-Type-Options"] = "nosniff";
    }
    if (metadata.contentDisposition) headers["Content-Disposition"] = metadata.contentDisposition;
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(metadata?: { size: number; contentType: string }): Promise<string> {
    if (usesDiskStorage()) {
      if (!metadata) throw new Error("Upload metadata is required for disk storage.");
      const ticket = createStorageTicket({
        path: `/objects/uploads/${randomUUID()}`, method: "PUT", expires: Date.now() + 15 * 60 * 1000,
        ...metadata,
      });
      return `/api/storage/disk-upload?ticket=${ticket}`;
    }
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async saveObjectEntity(
    objectPath: string,
    data: Buffer,
    contentType: string,
    contentDisposition?: string
  ): Promise<void> {
    if (usesDiskStorage()) {
      await saveDiskObject(objectPath, data, contentType, contentDisposition);
      return;
    }
    if (!objectPath.startsWith("/objects/")) {
      throw new Error("Invalid object path");
    }

    let privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir.endsWith("/")) {
      privateObjectDir = `${privateObjectDir}/`;
    }
    const rawPath = objectPath.slice("/objects/".length);
    const { bucketName, objectName } = parseObjectPath(`${privateObjectDir}${rawPath}`);
    await objectStorageClient.bucket(bucketName).file(objectName).save(data, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "private, no-store",
        ...(contentDisposition ? { contentDisposition } : {}),
      },
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<File | DiskObject> {
    if (usesDiskStorage()) {
      try {
        const file = new DiskObject(objectPath);
        await file.getMetadata();
        return file;
      } catch (error) {
        if (isMissingDiskObject(error)) throw new ObjectNotFoundError();
        throw error;
      }
    }
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  async getObjectEntityReadURL(objectPath: string, ttlSec: number = 300): Promise<string> {
    const objectFile = await this.getObjectEntityFile(objectPath);
    if (objectFile instanceof DiskObject) {
      return `/api/storage/disk-read?ticket=${createStorageTicket({ path: objectPath, method: "GET", expires: Date.now() + ttlSec * 1000 })}`;
    }
    return signObjectURL({
      bucketName: objectFile.bucket.name,
      objectName: objectFile.name,
      method: "GET",
      ttlSec,
    });
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (usesDiskStorage() && rawPath.startsWith("/api/storage/disk-upload?")) {
      const ticket = readStorageTicket(new URL(rawPath, "http://localhost").searchParams.get("ticket"), "PUT");
      if (!ticket) throw new Error("Invalid upload ticket.");
      return ticket.path;
    }
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    if (objectFile instanceof DiskObject) throw new Error("Disk storage authorizes objects through persisted resource references, not GCS ACLs.");
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = (await response.json()) as {
    signed_url: string;
  };
  return signedURL;
}
