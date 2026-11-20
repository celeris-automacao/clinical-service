import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import type { Express } from "express";
import { createStorageTicket } from "../../lib/diskStorage";

const hasTestDatabase = !!process.env.DATABASE_URL
  && /^modula_clinic_test(?:_[a-z0-9_]+)?$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1));

describe.skipIf(!hasTestDatabase)("disk storage checklist with real database and independent clinics", () => {
  let models: typeof import("@workspace/db");
  let app: Express;
  let root: string;
  let ownerToken: string;
  let otherToken: string;
  let misleadingClinicToken: string;
  let clinicId: number;
  let doctorId: number;
  const userIds: number[] = [];
  const clinicIds: number[] = [];
  const paths: string[] = [];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0u0AAAAASUVORK5CYII=", "base64");
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
  const cases = ["logo", "professional", "gallery", "receipt"] as const;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "modula-storage-integration-"));
    vi.stubEnv("STORAGE_PROVIDER", "disk");
    vi.stubEnv("LOCAL_UPLOAD_DIR", root);
    vi.stubEnv("STORAGE_SIGNING_SECRET", "integration-signing-key-with-more-than-32-characters");
    models = await import("@workspace/db");
    app = (await import("../../app")).default;
    const { signClinicScopedToken } = await import("../../lib/jwt");
    const suffix = randomUUID();
    const users = await models.db.insert(models.usersTable).values([
      { name: "Storage Owner A", email: `storage-a-${suffix}@example.invalid`, role: "clinic_owner" },
      { name: "Storage Owner B", email: `storage-b-${suffix}@example.invalid`, role: "clinic_owner" },
      { name: "Storage Doctor", email: `storage-doctor-${suffix}@example.invalid`, role: "profissional_saude" },
    ]).returning();
    userIds.push(...users.map((user) => user.id));
    const clinics = await models.db.insert(models.clinicsTable).values([{ name: `Storage A ${suffix}` }, { name: `Storage B ${suffix}` }]).returning();
    clinicIds.push(...clinics.map((clinic) => clinic.id));
    clinicId = clinics[0].id;
    await models.db.insert(models.clinicOwnersTable).values([
      { userId: users[0].id, clinicId }, { userId: users[1].id, clinicId: clinics[1].id },
    ]);
    const [doctor] = await models.db.insert(models.doctorsTable).values({ userId: users[2].id, clinicId, showOnPublicPage: true }).returning();
    doctorId = doctor.id;
    ownerToken = await signClinicScopedToken(users[0].id, users[0].email, users[0].role, clinicId);
    otherToken = await signClinicScopedToken(users[1].id, users[1].email, users[1].role, clinics[1].id);
    misleadingClinicToken = await signClinicScopedToken(users[1].id, users[1].email, users[1].role, clinicId);
    await models.db.insert(models.clinicPublicPagesTable).values({ clinicId, slug: `storage-${suffix}`, published: false });
  }, 30_000);

  afterAll(async () => {
    if (models && clinicIds.length) {
      await models.db.delete(models.expensesTable).where(inArray(models.expensesTable.clinicId, clinicIds));
      await models.db.delete(models.doctorsTable).where(inArray(models.doctorsTable.clinicId, clinicIds));
      await models.db.delete(models.clinicsTable).where(inArray(models.clinicsTable.id, clinicIds));
    }
    if (models && userIds.length) await models.db.delete(models.usersTable).where(inArray(models.usersTable.id, userIds));
    vi.unstubAllEnvs();
    if (root) await rm(root, { recursive: true, force: true });
  });

  async function upload(data: Buffer, contentType: string) {
    const issued = await request(app).post("/api/storage/uploads/request-url").auth(ownerToken, { type: "bearer" })
      .send({ name: "checklist-file", size: data.length, contentType }).expect(200);
    const result = await request(app).put(issued.body.uploadUrl).set("Content-Type", contentType).send(data);
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    await request(app).put(issued.body.uploadUrl).set("Content-Type", contentType).send(data).expect(409);
    return String(issued.body.objectPath);
  }

  it.each(cases)("uploads, saves, reloads and reads %s; denies B and anonymous", async (kind) => {
    const data = kind === "receipt" ? pdf : png;
    const contentType = kind === "receipt" ? "application/pdf" : "image/png";
    const objectPath = await upload(data, contentType);
    paths.push(objectPath);
    const auth = { Authorization: `Bearer ${ownerToken}` };
    if (kind === "logo") {
      await request(app).patch(`/api/clinics/${clinicId}`).set(auth).send({ logoUrl: objectPath }).expect(200);
      const [saved] = await models.db.select().from(models.clinicsTable).where(eq(models.clinicsTable.id, clinicId));
      expect(saved.logoUrl).toBe(objectPath);
    } else if (kind === "professional") {
      await request(app).patch(`/api/clinic/public-page/team/${doctorId}`).set(auth).send({ avatarUrl: objectPath }).expect(200);
      const saved = await request(app).get("/api/doctors").set(auth).expect(200);
      expect(saved.body.some((doctor: { avatarUrl: string }) => doctor.avatarUrl === objectPath)).toBe(true);
    } else if (kind === "gallery") {
      await request(app).post("/api/clinic/public-page/gallery").set(auth).send({ url: objectPath, caption: "Storage checklist" }).expect(201);
      const saved = await request(app).get("/api/clinic/public-page/gallery").set(auth).expect(200);
      expect(saved.body.some((photo: { url: string }) => photo.url === objectPath)).toBe(true);
    } else {
      const saved = await request(app).post("/api/finance/expenses").set(auth)
        .send({ category: "outro", description: "Storage checklist", amount: 10, period: "2026-10", receiptUrl: objectPath }).expect(201);
      expect(saved.body.receiptUrl).toBe(objectPath);
    }
    const signed = await request(app).get("/api/storage/objects/sign").query({ path: objectPath }).set(auth).expect(200);
    const downloaded = await request(app).get(signed.body.url).expect(200);
    expect(downloaded.headers["content-type"]).toContain(contentType);
    expect(downloaded.headers["cache-control"]).toBe("private, no-store");
    expect(downloaded.body).toEqual(data);
    await request(app).get(`/api/storage${objectPath}`).set(auth).expect(200);
    for (const token of [otherToken, misleadingClinicToken]) {
      await request(app).get("/api/storage/objects/sign").query({ path: objectPath }).auth(token, { type: "bearer" }).expect(403);
      await request(app).get(`/api/storage${objectPath}`).auth(token, { type: "bearer" }).expect(403);
    }
    await request(app).get("/api/storage/objects/sign").query({ path: objectPath }).expect(401);
    await request(app).get(`/api/storage${objectPath}`).expect(401);
  });

  it("exposes only published page images and revokes new anonymous signatures on unpublish", async () => {
    expect(paths).toHaveLength(4);
    const auth = { Authorization: `Bearer ${ownerToken}` };
    await request(app).patch("/api/clinic/public-page").set(auth).send({ published: true }).expect(200);
    let oldSignedUrl = "";
    for (const objectPath of paths.slice(0, 3)) {
      const issued = await request(app).get("/api/storage/objects/sign").query({ path: objectPath }).expect(200);
      await request(app).get(issued.body.url).expect(200);
      oldSignedUrl = issued.body.url;
    }
    await request(app).get("/api/storage/objects/sign").query({ path: paths[3] }).expect(401);
    await request(app).patch("/api/clinic/public-page").set(auth).send({ published: false }).expect(200);
    await request(app).get("/api/storage/objects/sign").query({ path: paths[0] }).expect(401);
    await request(app).get(oldSignedUrl).expect(200);
    const expired = createStorageTicket({ path: paths[0], method: "GET", expires: Date.now() - 1 });
    await request(app).get("/api/storage/disk-read").query({ ticket: expired }).expect(403);
  });

  it("rejects unsigned, tampered, wrong-method, oversized and MIME-spoofed uploads", async () => {
    await request(app).post("/api/storage/uploads/request-url").send({ name: "a", size: 8, contentType: "image/png" }).expect(401);
    for (const metadata of [
      { size: 0, contentType: "image/png" }, { size: 10 * 1024 * 1024 + 1, contentType: "image/png" },
      { size: 8, contentType: "image/svg+xml" },
    ]) {
      await request(app).post("/api/storage/uploads/request-url").auth(ownerToken, { type: "bearer" }).send({ name: "invalid", ...metadata }).expect(400);
    }
    await request(app).put("/api/storage/disk-upload").set("Content-Type", "image/png").send(png).expect(403);
    const issued = await request(app).post("/api/storage/uploads/request-url").auth(ownerToken, { type: "bearer" })
      .send({ name: "a", size: png.length, contentType: "image/png" }).expect(200);
    await request(app).put(`${issued.body.uploadUrl}x`).set("Content-Type", "image/png").send(png).expect(403);
    await request(app).put(issued.body.uploadUrl).set("Content-Type", "image/png").send(Buffer.alloc(png.length)).expect(400);
    await request(app).put(issued.body.uploadUrl).set("Content-Type", "image/png").send(png.subarray(1)).expect(400);
    await request(app).put(issued.body.uploadUrl).set("Content-Type", "application/pdf").send(png).expect(400);
    await request(app).put(issued.body.uploadUrl).set("Content-Type", "image/png").send(Buffer.alloc(10 * 1024 * 1024 + 1)).expect(413);
    const expiredUpload = createStorageTicket({ path: "/objects/uploads/expired", method: "PUT", size: png.length, contentType: "image/png", expires: Date.now() - 1 });
    await request(app).put("/api/storage/disk-upload").query({ ticket: expiredUpload }).set("Content-Type", "image/png").send(png).expect(403);
    const readTicket = createStorageTicket({ path: paths[0], method: "GET", expires: Date.now() + 60_000 });
    await request(app).put("/api/storage/disk-upload").query({ ticket: readTicket }).set("Content-Type", "image/png").send(png).expect(403);
  });
});
