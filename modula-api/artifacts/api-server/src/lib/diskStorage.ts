import { createHmac, timingSafeEqual } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod/v4";

const ticketSchema = z.object({
  path: z.string().regex(/^\/objects\/[a-zA-Z0-9_/-]+(?:\.[a-zA-Z0-9]+)?$/).refine(
    (value) => value.slice(9).split("/").every((part) => part !== "." && part !== ".." && part.length > 0),
  ),
  method: z.enum(["GET", "PUT"]),
  expires: z.number().int().positive(),
  size: z.number().int().positive().max(10 * 1024 * 1024).optional(),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]).optional(),
});
export type StorageTicket = z.infer<typeof ticketSchema>;
const metadataSchema = z.object({
  contentType: z.string(),
  size: z.number().int().nonnegative(),
  contentDisposition: z.string().optional(),
});

export function usesDiskStorage() {
  const provider = process.env.STORAGE_PROVIDER ?? "disk";
  if (!["disk", "replit"].includes(provider)) throw new Error("STORAGE_PROVIDER must be disk or replit.");
  return provider === "disk";
}

function storageRoot() {
  const root = process.env.LOCAL_UPLOAD_DIR;
  if (!root || !path.isAbsolute(root)) throw new Error("Disk storage requires an absolute LOCAL_UPLOAD_DIR on a persistent private volume.");
  return root;
}

function signingSecret() {
  const secret = process.env.STORAGE_SIGNING_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Disk storage requires STORAGE_SIGNING_SECRET or SESSION_SECRET with at least 32 characters.");
  return secret;
}

export async function validateDiskStorage() {
  storageRoot();
  signingSecret();
  await mkdir(storageRoot(), { recursive: true, mode: 0o700 });
  await access(storageRoot(), constants.R_OK | constants.W_OK);
}

function signature(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createStorageTicket(input: unknown) {
  const payload = Buffer.from(JSON.stringify(ticketSchema.parse(input))).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readStorageTicket(raw: unknown, method: "GET" | "PUT"): StorageTicket | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  const parts = raw.split(".");
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
  const expected = Buffer.from(signature(parts[0]), "base64url");
  const supplied = Buffer.from(parts[1], "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  const parsed = ticketSchema.safeParse(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
  if (!parsed.success || parsed.data.method !== method || parsed.data.expires <= Date.now()) return null;
  if (method === "PUT" && (!parsed.data.size || !parsed.data.contentType)) return null;
  return parsed.data;
}

function filePath(objectPath: string) {
  if (!ticketSchema.shape.path.safeParse(objectPath).success) throw new Error("Invalid disk object path.");
  return path.join(storageRoot(), objectPath.slice("/objects/".length));
}

export function matchesUploadType(data: Buffer, contentType: string) {
  if (contentType === "image/png") return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/jpeg") return data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255;
  if (contentType === "image/webp") return data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP";
  if (contentType === "application/pdf") return data.subarray(0, 5).toString() === "%PDF-";
  return false;
}

export class DiskObject {
  constructor(readonly objectPath: string) {}

  async getMetadata(): Promise<[z.infer<typeof metadataSchema>]> {
    const metadata = metadataSchema.parse(JSON.parse(await readFile(`${filePath(this.objectPath)}.json`, "utf8")));
    const details = await stat(filePath(this.objectPath));
    if (!details.isFile() || details.size !== metadata.size) throw new Error("Stored object size does not match metadata.");
    return [metadata];
  }

  createReadStream() {
    return createReadStream(filePath(this.objectPath));
  }
}

export async function saveDiskObject(objectPath: string, data: Buffer, contentType: string, contentDisposition?: string) {
  const target = filePath(objectPath);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, data, { flag: "wx", mode: 0o600 });
  try {
    await writeFile(`${target}.json`, JSON.stringify({ contentType, size: data.length, contentDisposition }), { flag: "wx", mode: 0o600 });
  } catch (error) {
    await unlink(target);
    throw error;
  }
}

export function isMissingDiskObject(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
