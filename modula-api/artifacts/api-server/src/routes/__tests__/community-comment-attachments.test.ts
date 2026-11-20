import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  requireAuth: vi.fn(),
  publishToClinic: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const table = new Proxy({}, { get: (_target, key) => ({ name: key }) });
  return {
    db: { select: mocks.select, insert: mocks.insert },
    communityPostsTable: table,
    communityCommentsTable: table,
    communityPostLikesTable: table,
    communityNotificationMutesTable: table,
    communityReportsTable: table,
    usersTable: table,
    clinicsTable: table,
    doctorsTable: table,
    patientsTable: table,
    patientClinicsTable: table,
    clinicOwnersTable: table,
    secretariesTable: table,
    conversationsTable: table,
    messagesTable: table,
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
  lt: vi.fn(() => ({})),
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: mocks.requireAuth,
  isError: vi.fn(() => false),
  resolveOwnerClinicId: vi.fn(),
  resolveSecretaryClinicId: vi.fn(),
}));

vi.mock("../../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    getObjectEntityFile = vi.fn().mockResolvedValue({});
  },
}));

vi.mock("../../lib/diskStorage", () => ({
  usesDiskStorage: vi.fn(() => false),
}));

vi.mock("../../lib/email", () => ({
  sendCommunityContentRemovedEmail: vi.fn(),
}));

vi.mock("../../lib/sse-hub", () => ({
  subscribeToClinic: vi.fn(),
  unsubscribeFromClinic: vi.fn(),
  publishToClinic: mocks.publishToClinic,
  publishToUser: vi.fn(),
}));

import communityRouter from "../community";

function makeSelectChain(data: unknown[]): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(data);
  chain.orderBy = vi.fn().mockResolvedValue(data);
  return chain;
}

function makeInsertChain(data: unknown[]): any {
  const chain: any = {};
  chain.values = vi.fn((values) => {
    chain.insertedValues = values;
    return chain;
  });
  chain.returning = vi.fn().mockResolvedValue(data);
  return chain;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    _req.log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(communityRouter);
  return app;
}

describe("POST /community/posts/:postId/comments with attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists an attachment-only comment uploaded by the current clinic member", async () => {
    const mediaUrl = "/objects/community/4/7/12345678-1234-1234-1234-123456789abc";
    const post = { id: 12, clinicId: 4, authorUserId: 8, content: "Post" };
    const savedComment = {
      id: 20,
      postId: 12,
      authorUserId: 7,
      content: "",
      mediaUrl,
      mediaType: "photo",
      mediaName: "photo.png",
      mediaContentType: "image/png",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
    };

    mocks.requireAuth.mockResolvedValue({
      user: { id: 7, role: "patient" },
      clinicId: 4,
    });
    mocks.select
      .mockReturnValueOnce(makeSelectChain([post]))
      .mockReturnValueOnce(makeSelectChain([{ id: 2 }]))
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 4 }]))
      .mockReturnValueOnce(makeSelectChain([{ name: "Patient", avatarUrl: null, role: "patient" }]));
    const insertChain = makeInsertChain([savedComment]);
    mocks.insert.mockReturnValue(insertChain);

    const response = await request(buildApp())
      .post("/community/posts/12/comments")
      .send({
        mediaUrl,
        mediaType: "photo",
        mediaName: "photo.png",
        mediaContentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      content: "",
      mediaUrl,
      mediaType: "photo",
      mediaName: "photo.png",
      mediaContentType: "image/png",
    });
    expect(insertChain.insertedValues).toMatchObject({
      postId: 12,
      authorUserId: 7,
      content: "",
      mediaUrl,
      mediaType: "photo",
      mediaName: "photo.png",
      mediaContentType: "image/png",
    });
  });
});
