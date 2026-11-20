import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createStorageTicket, DiskObject, matchesUploadType, readStorageTicket,
  saveDiskObject, usesDiskStorage, validateDiskStorage,
} from "../diskStorage";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "modula-storage-test-"));
  vi.stubEnv("STORAGE_PROVIDER", "disk");
  vi.stubEnv("LOCAL_UPLOAD_DIR", root);
  vi.stubEnv("STORAGE_SIGNING_SECRET", "test-storage-signing-key-with-at-least-32-characters");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  await rm(root, { recursive: true, force: true });
});

const ticketInput = () => ({
  path: "/objects/uploads/unique-test-object", method: "PUT",
  expires: Date.now() + 60_000, size: 9, contentType: "image/png",
});

describe("private disk storage", () => {
  it("defaults to disk and supports Replit only when selected", () => {
    vi.stubEnv("STORAGE_PROVIDER", undefined);
    expect(usesDiskStorage()).toBe(true);
    vi.stubEnv("STORAGE_PROVIDER", "replit");
    expect(usesDiskStorage()).toBe(false);
    vi.stubEnv("STORAGE_PROVIDER", "typo");
    expect(() => usesDiskStorage()).toThrow("STORAGE_PROVIDER");
  });

  it("requires a private absolute root and a strong signing secret", async () => {
    await expect(validateDiskStorage()).resolves.toBeUndefined();
    vi.stubEnv("LOCAL_UPLOAD_DIR", "relative");
    await expect(validateDiskStorage()).rejects.toThrow("absolute");
    vi.stubEnv("LOCAL_UPLOAD_DIR", root);
    vi.stubEnv("STORAGE_SIGNING_SECRET", "short");
    await expect(validateDiskStorage()).rejects.toThrow("32 characters");
  });

  it("roundtrips a signed ticket and binds HTTP method, path, size and content type", () => {
    const input = ticketInput();
    const ticket = createStorageTicket(input);
    expect(readStorageTicket(ticket, "PUT")).toEqual(input);
    expect(readStorageTicket(ticket, "GET")).toBeNull();
    for (const change of [{ path: "/objects/other" }, { size: 10 }, { contentType: "application/pdf" }, { expires: Date.now() + 999999 }]) {
      const payload = Buffer.from(JSON.stringify({ ...input, ...change })).toString("base64url");
      expect(readStorageTicket(`${payload}.${ticket.split(".")[1]}`, "PUT")).toBeNull();
    }
  });

  it("rejects expired, malformed and unsigned URLs", () => {
    expect(readStorageTicket(createStorageTicket({ ...ticketInput(), expires: Date.now() - 1 }), "PUT")).toBeNull();
    for (const value of [null, [], "", "a", "a.b", "a.b.c", "x".repeat(4097)]) {
      expect(readStorageTicket(value, "PUT")).toBeNull();
    }
  });

  it.each(["/objects/../secret", "/objects//secret", "/objects/a/./b", "/objects/a\\b", "/objects/%2e%2e/a", "/public/a"])(
    "rejects traversal or invalid paths: %s", async (objectPath) => {
      expect(() => createStorageTicket({ ...ticketInput(), path: objectPath })).toThrow();
      await expect(saveDiskObject(objectPath, Buffer.from("data"), "text/plain")).rejects.toThrow();
    },
  );

  it("validates permitted size and content types before issuing a ticket", () => {
    for (const size of [0, -1, 0.5, 10 * 1024 * 1024 + 1]) {
      expect(() => createStorageTicket({ ...ticketInput(), size })).toThrow();
    }
    expect(() => createStorageTicket({ ...ticketInput(), contentType: "image/svg+xml" })).toThrow();
  });

  it("persists bytes and metadata across object instances without overwrite", async () => {
    const objectPath = "/objects/uploads/persisted";
    await saveDiskObject(objectPath, Buffer.from("data"), "text/plain", "attachment");
    await expect(saveDiskObject(objectPath, Buffer.from("other"), "text/plain")).rejects.toMatchObject({ code: "EEXIST" });
    const file = new DiskObject(objectPath);
    expect(await file.getMetadata()).toEqual([{ contentType: "text/plain", size: 4, contentDisposition: "attachment" }]);
    const chunks: Buffer[] = [];
    for await (const chunk of new DiskObject(objectPath).createReadStream()) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("data");
  });

  it("rejects MIME spoofing for PNG, JPEG, WEBP and PDF", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "application/pdf", "text/html"]) {
      expect(matchesUploadType(Buffer.from("<script>alert(1)</script>"), type)).toBe(false);
    }
    expect(matchesUploadType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png")).toBe(true);
    expect(matchesUploadType(Buffer.from([255, 216, 255]), "image/jpeg")).toBe(true);
    expect(matchesUploadType(Buffer.from("RIFF0000WEBP"), "image/webp")).toBe(true);
    expect(matchesUploadType(Buffer.from("%PDF-1.7\n"), "application/pdf")).toBe(true);
  });
});
