import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router, raw, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import {
  db,
  communityPostsTable,
  communityCommentsTable,
  communityPostLikesTable,
  communityNotificationMutesTable,
  communityReportsTable,
  usersTable,
  clinicsTable,
  doctorsTable,
  patientsTable,
  patientClinicsTable,
  clinicOwnersTable,
  secretariesTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { sendCommunityContentRemovedEmail } from "../lib/email";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { usesDiskStorage } from "../lib/diskStorage";
import {
  requireAuth,
  isError,
  resolveOwnerClinicId,
  resolveSecretaryClinicId,
} from "../lib/auth-helpers";
import { subscribeToClinic, unsubscribeFromClinic, publishToClinic, publishToUser } from "../lib/sse-hub";
import {
  CreateCommunityPostBody,
  CreateCommunityCommentBody,
  ReportCommunityPostBody,
  ReportCommunityCommentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_COMMUNITY_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const COMMUNITY_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

function getLocalCommunityMediaFilePath(mediaUrl: string): string | null {
  const match = /^\/local-community-media\/\d+\/\d+\/([0-9a-f-]{36})$/i.exec(mediaUrl);
  if (!match) return null;
  const root = process.env.LOCAL_UPLOAD_DIR || path.resolve(process.cwd(), ".local-uploads");
  return path.join(root, "community", match[1]);
}

function sanitizeCommunityMediaName(rawName: string | undefined): string | null {
  if (!rawName) return null;
  let decodedName: string;
  try {
    decodedName = decodeURIComponent(rawName);
  } catch {
    return null;
  }
  const name = decodedName.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return name && name.length <= 255 ? name : null;
}

function getCommunityMediaType(contentType: string): "photo" | "video" | "file" {
  return contentType.startsWith("image/") ? "photo" : contentType.startsWith("video/") ? "video" : "file";
}

function isOwnedCommunityMediaPath(mediaUrl: string, clinicId: number, userId: number): boolean {
  const suffix = "[0-9a-f-]{36}";
  return (
    new RegExp(`^/objects/community/${clinicId}/${userId}/${suffix}$`, "i").test(mediaUrl) ||
    new RegExp(`^/local-community-media/${clinicId}/${userId}/${suffix}$`, "i").test(mediaUrl)
  );
}

async function communityMediaExists(mediaUrl: string): Promise<boolean> {
  const localPath = getLocalCommunityMediaFilePath(mediaUrl);
  if (localPath) {
    try {
      return (await stat(localPath)).isFile();
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
      throw error;
    }
  }
  try {
    await objectStorageService.getObjectEntityFile(mediaUrl);
    return true;
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return false;
    throw error;
  }
}

router.post(
  "/community/uploads",
  raw({ type: () => true, limit: MAX_COMMUNITY_ATTACHMENT_SIZE }),
  async (req, res): Promise<void> => {
    const authResult = await requireAuth(req);
    if (isError(authResult)) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    const clinicId = await resolveCallerClinicId(authResult.user, authResult.clinicId);
    if (clinicId === null) {
      res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
      return;
    }
    if (
      !Buffer.isBuffer(req.body) ||
      req.body.length === 0 ||
      req.body.length > MAX_COMMUNITY_ATTACHMENT_SIZE
    ) {
      res.status(400).json({ error: "Arquivo vazio ou maior que o limite de 50 MB." });
      return;
    }

    const mediaName = sanitizeCommunityMediaName(req.get("x-file-name"));
    const mediaContentType = (req.get("x-file-content-type") || "").trim().toLowerCase();
    if (!mediaName || !COMMUNITY_ATTACHMENT_TYPES.has(mediaContentType)) {
      res.status(400).json({ error: "Nome ou formato de arquivo não suportado." });
      return;
    }

    const mediaType = getCommunityMediaType(mediaContentType);
    const fileId = randomUUID();
    try {
      let mediaUrl: string;
      if (usesDiskStorage() || process.env.PRIVATE_OBJECT_DIR) {
        mediaUrl = `/objects/community/${clinicId}/${authResult.user.id}/${fileId}`;
        const disposition = mediaType === "file" ? "attachment" : "inline";
        await objectStorageService.saveObjectEntity(
          mediaUrl,
          req.body,
          mediaContentType,
          `${disposition}; filename*=UTF-8''${encodeURIComponent(mediaName)}`
        );
      } else if (process.env.NODE_ENV !== "production") {
        const localPath = path.join(
          process.env.LOCAL_UPLOAD_DIR || path.resolve(process.cwd(), ".local-uploads"),
          "community",
          fileId
        );
        await mkdir(path.dirname(localPath), { recursive: true });
        await writeFile(localPath, req.body, { flag: "wx" });
        mediaUrl = `/local-community-media/${clinicId}/${authResult.user.id}/${fileId}`;
      } else {
        res.status(503).json({ error: "Armazenamento de arquivos não configurado." });
        return;
      }

      res.status(201).json({ mediaUrl, mediaType, mediaName, mediaContentType });
    } catch (error) {
      req.log.error({ err: error, clinicId, userId: authResult.user.id }, "Failed to upload community attachment");
      res.status(500).json({ error: "Não foi possível salvar o arquivo." });
    }
  }
);

router.get("/community/media", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const mediaUrl = req.query.path;
  if (typeof mediaUrl !== "string") {
    res.status(400).json({ error: "Caminho do arquivo inválido." });
    return;
  }
  const localPath = getLocalCommunityMediaFilePath(mediaUrl);
  if (!localPath) {
    res.status(404).json({ error: "Arquivo não encontrado." });
    return;
  }

  const clinicId = await resolveCallerClinicId(authResult.user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }
  const [post] = await db
    .select({
      mediaName: communityPostsTable.mediaName,
      mediaContentType: communityPostsTable.mediaContentType,
    })
    .from(communityPostsTable)
    .where(and(eq(communityPostsTable.mediaUrl, mediaUrl), eq(communityPostsTable.clinicId, clinicId)))
    .limit(1);
  const [comment] = post ? [undefined] : await db
    .select({
      mediaName: communityCommentsTable.mediaName,
      mediaContentType: communityCommentsTable.mediaContentType,
    })
    .from(communityCommentsTable)
    .innerJoin(communityPostsTable, eq(communityCommentsTable.postId, communityPostsTable.id))
    .where(and(
      eq(communityCommentsTable.mediaUrl, mediaUrl),
      eq(communityPostsTable.clinicId, clinicId)
    ))
    .limit(1);
  const media = post ?? comment;
  if (!media) {
    res.status(404).json({ error: "Arquivo não encontrado." });
    return;
  }

  try {
    const fileStat = await stat(localPath);
    if (!fileStat.isFile()) {
      res.status(404).json({ error: "Arquivo não encontrado." });
      return;
    }
    const inline = media.mediaContentType?.startsWith("image/") || media.mediaContentType?.startsWith("video/");
    res.set({
      "Content-Type": media.mediaContentType || "application/octet-stream",
      "Content-Length": String(fileStat.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(media.mediaName || "arquivo")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    const stream = createReadStream(localPath);
    stream.on("error", (error) => {
      req.log.error({ err: error, mediaUrl }, "Failed to stream local community attachment");
      if (!res.headersSent) res.status(500).json({ error: "Não foi possível ler o arquivo." });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    req.log.error({ err: error, mediaUrl }, "Failed to read local community attachment");
    res.status(500).json({ error: "Não foi possível ler o arquivo." });
  }
});

/**
 * Resolve the effective clinic ID for the current caller, regardless of role.
 * Returns null when the caller has no resolvable clinic. Mirrors the local
 * helper in appointments.ts (patients can only ever post to their own clinic).
 */
async function resolveCallerClinicId(
  user: { id: number; role: string },
  jwtClinicId?: number
): Promise<number | null> {
  if (user.role === "clinic_owner") {
    return (await resolveOwnerClinicId(user.id, jwtClinicId)) ?? null;
  }
  if (user.role === "profissional_saude") {
    const [doc] = await db
      .select({ clinicId: doctorsTable.clinicId })
      .from(doctorsTable)
      .where(eq(doctorsTable.userId, user.id))
      .limit(1);
    return doc?.clinicId ?? null;
  }
  if (user.role === "patient") {
    const [patient] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, user.id))
      .limit(1);
    if (!patient) return null;
    const [enrollment] = await db
      .select({ clinicId: patientClinicsTable.clinicId })
      .from(patientClinicsTable)
      .where(eq(patientClinicsTable.patientId, patient.id))
      .limit(1);
    return enrollment?.clinicId ?? null;
  }
  if (user.role === "secretaria") {
    return (await resolveSecretaryClinicId(user.id, jwtClinicId)) ?? null;
  }
  return null;
}

function canModerate(role: string): boolean {
  return role === "clinic_owner" || role === "secretaria";
}

async function notifyCommunityContentRemoved(
  userId: number,
  clinicId: number,
  contentType: "comment" | "post",
  log: { error: (data: object, message: string) => void }
): Promise<boolean> {
  try {
    const [[member], [clinic]] = await Promise.all([
      db
        .select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1),
      db
        .select({ name: clinicsTable.name })
        .from(clinicsTable)
        .where(eq(clinicsTable.id, clinicId))
        .limit(1),
    ]);
    if (!member?.email) {
      log.error({ userId, clinicId, contentType }, "Cannot notify community content author: user email not found");
      return false;
    }

    return await sendCommunityContentRemovedEmail({
      to: member.email,
      name: member.name,
      clinicName: clinic?.name,
      contentType,
    });
  } catch (error) {
    log.error({ err: error, userId, clinicId, contentType }, "Failed to notify community content author");
    return false;
  }
}

async function getAuthorInfo(userId: number) {
  const [row] = await db
    .select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return {
    name: row?.name ?? "",
    avatarUrl: row?.avatarUrl ?? null,
    role: row?.role ?? "patient",
  };
}

async function buildPostResponse(
  post: typeof communityPostsTable.$inferSelect,
  viewer: { id: number; role: string }
) {
  const author = await getAuthorInfo(post.authorUserId);

  const likeRows = await db
    .select({ userId: communityPostLikesTable.userId })
    .from(communityPostLikesTable)
    .where(eq(communityPostLikesTable.postId, post.id));
  const likedByMe = likeRows.some((r) => r.userId === viewer.id);

  const commentRows = await db
    .select({ id: communityCommentsTable.id })
    .from(communityCommentsTable)
    .where(eq(communityCommentsTable.postId, post.id));

  const canDelete = post.authorUserId === viewer.id || canModerate(viewer.role);

  return {
    id: post.id,
    clinicId: post.clinicId,
    authorUserId: post.authorUserId,
    authorName: author.name,
    authorRole: author.role,
    authorAvatarUrl: author.avatarUrl,
    content: post.content,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
    mediaName: post.mediaName,
    mediaContentType: post.mediaContentType,
    likeCount: likeRows.length,
    likedByMe,
    commentCount: commentRows.length,
    canDelete,
    createdAt: post.createdAt.toISOString(),
  };
}

async function buildCommentResponse(
  comment: typeof communityCommentsTable.$inferSelect,
  viewer: { id: number; role: string }
) {
  const author = await getAuthorInfo(comment.authorUserId);
  return {
    id: comment.id,
    postId: comment.postId,
    authorUserId: comment.authorUserId,
    authorName: author.name,
    authorRole: author.role,
    authorAvatarUrl: author.avatarUrl,
    content: comment.content,
    mediaUrl: comment.mediaUrl,
    mediaType: comment.mediaType,
    mediaName: comment.mediaName,
    mediaContentType: comment.mediaContentType,
    canDelete: comment.authorUserId === viewer.id || canModerate(viewer.role),
    createdAt: comment.createdAt.toISOString(),
  };
}

async function createCommunityReportAndNotify({
  clinicId,
  reporterUserId,
  targetType,
  targetId,
  targetContent,
  reason,
}: {
  clinicId: number;
  reporterUserId: number;
  targetType: "post" | "comment";
  targetId: number;
  targetContent: string;
  reason?: string;
}) {
  const [owners, secretaries, reporter] = await Promise.all([
    db
      .select({ userId: clinicOwnersTable.userId })
      .from(clinicOwnersTable)
      .where(eq(clinicOwnersTable.clinicId, clinicId)),
    db
      .select({ userId: secretariesTable.userId })
      .from(secretariesTable)
      .where(eq(secretariesTable.clinicId, clinicId)),
    db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, reporterUserId))
      .limit(1),
  ]);
  const recipientIds = [...new Set([...owners, ...secretaries]
    .map(({ userId }) => userId)
    .filter((userId) => userId !== reporterUserId))];
  const activeRecipients = recipientIds.length
    ? await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(inArray(usersTable.id, recipientIds), isNull(usersTable.deactivatedAt)))
    : [];
  if (activeRecipients.length === 0) {
    throw new Error("Não há owner ou secretária ativa para receber a denúncia.");
  }

  const reportMessage = [
    `Denúncia da comunidade (${targetType === "post" ? "publicação" : "comentário"} #${targetId})`,
    `Denunciante: ${reporter[0]?.name ?? "Usuário da clínica"}`,
    `Conteúdo: ${targetContent.slice(0, 1200)}`,
    reason ? `Motivo: ${reason.slice(0, 500)}` : null,
  ].filter(Boolean).join("\n");
  const notifications: { conversationId: number; recipientId: number }[] = [];

  await db.transaction(async (tx) => {
    await tx.insert(communityReportsTable).values({
      clinicId,
      reporterUserId,
      targetType,
      targetId,
      reason: reason?.trim() || null,
    });

    for (const recipient of activeRecipients) {
      const participantAUserId = Math.min(reporterUserId, recipient.id);
      const participantBUserId = Math.max(reporterUserId, recipient.id);
      const whereParticipants = and(
        eq(conversationsTable.participantAUserId, participantAUserId),
        eq(conversationsTable.participantBUserId, participantBUserId),
        eq(conversationsTable.clinicId, clinicId)
      );
      const [existingConversation] = await tx
        .select()
        .from(conversationsTable)
        .where(whereParticipants)
        .limit(1);
      const conversation = existingConversation
        ?? (await tx
          .insert(conversationsTable)
          .values({ participantAUserId, participantBUserId, clinicId })
          .onConflictDoNothing()
          .returning())[0]
        ?? (await tx
          .select()
          .from(conversationsTable)
          .where(whereParticipants)
          .limit(1))[0];
      if (!conversation) {
        throw new Error("Não foi possível iniciar a conversa para encaminhar a denúncia.");
      }

      const [message] = await tx
        .insert(messagesTable)
        .values({
          conversationId: conversation.id,
          senderId: reporterUserId,
          content: reportMessage,
          attachments: [],
        })
        .returning();
      await tx
        .update(conversationsTable)
        .set({ lastMessageAt: message.createdAt })
        .where(eq(conversationsTable.id, conversation.id));
      notifications.push({ conversationId: conversation.id, recipientId: recipient.id });
    }
  });

  for (const notification of notifications) {
    publishToUser(reporterUserId, { type: "message", conversationId: notification.conversationId });
    publishToUser(notification.recipientId, { type: "message", conversationId: notification.conversationId });
  }
}

router.get("/community/posts", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.json([]);
    return;
  }

  const limitParam = parseInt(String(req.query.limit ?? "20"), 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;
  const beforeIdParam = req.query.beforeId;
  const beforeId = typeof beforeIdParam === "string" ? parseInt(beforeIdParam, 10) : undefined;

  const conditions = [eq(communityPostsTable.clinicId, clinicId)];
  if (beforeId !== undefined && !Number.isNaN(beforeId)) {
    conditions.push(lt(communityPostsTable.id, beforeId));
  }

  const rows = await db
    .select()
    .from(communityPostsTable)
    .where(and(...conditions))
    .orderBy(desc(communityPostsTable.id))
    .limit(limit);

  const results = await Promise.all(rows.map((p) => buildPostResponse(p, user)));
  res.json(results);
});

router.post("/community/posts", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const parsed = CreateCommunityPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const content = parsed.data.content?.trim();
  if (!content && !parsed.data.mediaUrl) {
    res.status(400).json({ error: "Informe um texto ou uma mídia para publicar." });
    return;
  }
  if (
    !parsed.data.mediaUrl &&
    (parsed.data.mediaType || parsed.data.mediaName || parsed.data.mediaContentType)
  ) {
    res.status(400).json({ error: "O arquivo enviado não foi encontrado." });
    return;
  }
  if (parsed.data.mediaUrl && !parsed.data.mediaType) {
    res.status(400).json({ error: "mediaType é obrigatório quando mediaUrl é informado." });
    return;
  }
  if (parsed.data.mediaUrl) {
    if (!isOwnedCommunityMediaPath(parsed.data.mediaUrl, clinicId, user.id)) {
      res.status(400).json({ error: "O arquivo não foi enviado para esta comunidade." });
      return;
    }
    if (
      !parsed.data.mediaName?.trim() ||
      parsed.data.mediaName.length > 255 ||
      !parsed.data.mediaContentType ||
      !COMMUNITY_ATTACHMENT_TYPES.has(parsed.data.mediaContentType) ||
      getCommunityMediaType(parsed.data.mediaContentType) !== parsed.data.mediaType
    ) {
      res.status(400).json({ error: "Os dados do arquivo anexado são inválidos." });
      return;
    }
    if (!(await communityMediaExists(parsed.data.mediaUrl))) {
      res.status(400).json({ error: "O arquivo enviado não está mais disponível." });
      return;
    }
  }

  const [post] = await db
    .insert(communityPostsTable)
    .values({
      clinicId,
      authorUserId: user.id,
      content: content || null,
      mediaUrl: parsed.data.mediaUrl ?? null,
      mediaType: parsed.data.mediaType ?? null,
      mediaName: parsed.data.mediaName?.trim() || null,
      mediaContentType: parsed.data.mediaContentType ?? null,
    })
    .returning();

  const result = await buildPostResponse(post, user);
  publishToClinic(clinicId, { type: "post" });
  res.status(201).json(result);
});

router.delete("/community/posts/:postId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const postId = parseInt(req.params.postId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "postId inválido" });
    return;
  }

  const [post] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, postId)).limit(1);
  if (!post) {
    res.status(404).json({ error: "Post não encontrado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== post.clinicId) {
    res.status(403).json({ error: "Este post não pertence à sua clínica." });
    return;
  }

  if (post.authorUserId !== user.id && !canModerate(user.role)) {
    res.status(403).json({ error: "Você não tem permissão para excluir este post." });
    return;
  }

  await db.delete(communityPostsTable).where(eq(communityPostsTable.id, postId));

  publishToClinic(post.clinicId, { type: "post-deleted", postId });
  res.json({ success: true });
});

router.post("/community/posts/:postId/like", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const postId = parseInt(req.params.postId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "postId inválido" });
    return;
  }

  const [post] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, postId)).limit(1);
  if (!post) {
    res.status(404).json({ error: "Post não encontrado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== post.clinicId) {
    res.status(403).json({ error: "Este post não pertence à sua clínica." });
    return;
  }

  const [existingLike] = await db
    .select()
    .from(communityPostLikesTable)
    .where(and(eq(communityPostLikesTable.postId, postId), eq(communityPostLikesTable.userId, user.id)))
    .limit(1);

  let liked: boolean;
  if (existingLike) {
    await db.delete(communityPostLikesTable).where(eq(communityPostLikesTable.id, existingLike.id));
    liked = false;
  } else {
    await db
      .insert(communityPostLikesTable)
      .values({ postId, userId: user.id })
      .onConflictDoNothing();
    liked = true;
  }

  const likeRows = await db
    .select({ id: communityPostLikesTable.id })
    .from(communityPostLikesTable)
    .where(eq(communityPostLikesTable.postId, postId));

  publishToClinic(post.clinicId, { type: "like", postId });
  res.json({ liked, likeCount: likeRows.length });
});

router.get("/community/posts/:postId/comments", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const postId = parseInt(req.params.postId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "postId inválido" });
    return;
  }

  const [post] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, postId)).limit(1);
  if (!post) {
    res.status(404).json({ error: "Post não encontrado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== post.clinicId) {
    res.status(403).json({ error: "Este post não pertence à sua clínica." });
    return;
  }

  const rows = await db
    .select()
    .from(communityCommentsTable)
    .where(eq(communityCommentsTable.postId, postId))
    .orderBy(communityCommentsTable.id);

  const results = await Promise.all(rows.map((c) => buildCommentResponse(c, user)));
  res.json(results);
});

router.post("/community/posts/:postId/comments", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const postId = parseInt(req.params.postId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "postId inválido" });
    return;
  }

  const [post] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, postId)).limit(1);
  if (!post) {
    res.status(404).json({ error: "Post não encontrado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== post.clinicId) {
    res.status(403).json({ error: "Este post não pertence à sua clínica." });
    return;
  }

  const parsed = CreateCommunityCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const content = parsed.data.content?.trim() ?? "";
  if (!content && !parsed.data.mediaUrl) {
    res.status(400).json({ error: "Informe um texto ou anexo para comentar." });
    return;
  }
  if (
    !parsed.data.mediaUrl
    && (parsed.data.mediaType || parsed.data.mediaName || parsed.data.mediaContentType)
  ) {
    res.status(400).json({ error: "O arquivo enviado não foi encontrado." });
    return;
  }
  if (parsed.data.mediaUrl && !parsed.data.mediaType) {
    res.status(400).json({ error: "mediaType é obrigatório quando mediaUrl é informado." });
    return;
  }
  if (parsed.data.mediaUrl) {
    if (!isOwnedCommunityMediaPath(parsed.data.mediaUrl, clinicId, user.id)) {
      res.status(400).json({ error: "O arquivo não foi enviado para esta comunidade." });
      return;
    }
    if (
      !parsed.data.mediaName?.trim()
      || parsed.data.mediaName.length > 255
      || !parsed.data.mediaContentType
      || !COMMUNITY_ATTACHMENT_TYPES.has(parsed.data.mediaContentType)
      || getCommunityMediaType(parsed.data.mediaContentType) !== parsed.data.mediaType
    ) {
      res.status(400).json({ error: "Os dados do arquivo anexado são inválidos." });
      return;
    }
    if (!(await communityMediaExists(parsed.data.mediaUrl))) {
      res.status(400).json({ error: "O arquivo enviado não está mais disponível." });
      return;
    }
  }

  const [comment] = await db
    .insert(communityCommentsTable)
    .values({
      postId,
      authorUserId: user.id,
      content,
      mediaUrl: parsed.data.mediaUrl ?? null,
      mediaType: parsed.data.mediaType ?? null,
      mediaName: parsed.data.mediaName?.trim() || null,
      mediaContentType: parsed.data.mediaContentType ?? null,
    })
    .returning();

  const result = await buildCommentResponse(comment, user);
  publishToClinic(post.clinicId, { type: "comment", postId });
  res.status(201).json(result);
});

router.delete("/community/comments/:commentId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const commentId = parseInt(req.params.commentId, 10);
  if (Number.isNaN(commentId)) {
    res.status(400).json({ error: "commentId inválido" });
    return;
  }

  const [comment] = await db
    .select()
    .from(communityCommentsTable)
    .where(eq(communityCommentsTable.id, commentId))
    .limit(1);
  if (!comment) {
    res.status(404).json({ error: "Comentário não encontrado" });
    return;
  }

  const [post] = await db
    .select()
    .from(communityPostsTable)
    .where(eq(communityPostsTable.id, comment.postId))
    .limit(1);
  if (!post) {
    res.status(404).json({ error: "Post não encontrado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== post.clinicId) {
    res.status(403).json({ error: "Este comentário não pertence à sua clínica." });
    return;
  }

  if (comment.authorUserId !== user.id && !canModerate(user.role)) {
    res.status(403).json({ error: "Você não tem permissão para excluir este comentário." });
    return;
  }

  await db.delete(communityCommentsTable).where(eq(communityCommentsTable.id, commentId));

  const authorNotified =
    comment.authorUserId !== user.id
      ? await notifyCommunityContentRemoved(comment.authorUserId, post.clinicId, "comment", req.log)
      : false;

  publishToClinic(post.clinicId, { type: "comment-deleted", postId: post.id });
  res.json({ success: true, authorNotified });
});

router.post("/community/posts/:postId/report", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const postId = parseInt(req.params.postId, 10);
  if (Number.isNaN(postId)) {
    res.status(400).json({ error: "postId inválido" });
    return;
  }

  const [post] = await db.select().from(communityPostsTable).where(eq(communityPostsTable.id, postId)).limit(1);
  if (!post) {
    res.status(404).json({ error: "Post não encontrado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== post.clinicId) {
    res.status(403).json({ error: "Este post não pertence à sua clínica." });
    return;
  }

  if (post.authorUserId === user.id) {
    res.status(400).json({ error: "Você não pode denunciar o próprio conteúdo." });
    return;
  }

  const parsed = ReportCommunityPostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select({ id: communityReportsTable.id })
    .from(communityReportsTable)
    .where(
      and(
        eq(communityReportsTable.targetType, "post"),
        eq(communityReportsTable.targetId, postId),
        eq(communityReportsTable.reporterUserId, user.id),
        eq(communityReportsTable.status, "open")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Você já denunciou este conteúdo." });
    return;
  }

  await createCommunityReportAndNotify({
    clinicId: post.clinicId,
    reporterUserId: user.id,
    targetType: "post",
    targetId: postId,
    targetContent: post.content?.trim() || `Arquivo anexado: ${post.mediaName ?? "sem título"}`,
    reason: parsed.data.reason?.trim(),
  });

  res.status(201).json({ success: true });
});

router.post("/community/comments/:commentId/report", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const commentId = parseInt(req.params.commentId, 10);
  if (Number.isNaN(commentId)) {
    res.status(400).json({ error: "commentId inválido" });
    return;
  }

  const [comment] = await db
    .select()
    .from(communityCommentsTable)
    .where(eq(communityCommentsTable.id, commentId))
    .limit(1);
  if (!comment) {
    res.status(404).json({ error: "Comentário não encontrado" });
    return;
  }

  const [post] = await db
    .select()
    .from(communityPostsTable)
    .where(eq(communityPostsTable.id, comment.postId))
    .limit(1);
  if (!post) {
    res.status(404).json({ error: "Post não encontrado" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== post.clinicId) {
    res.status(403).json({ error: "Este comentário não pertence à sua clínica." });
    return;
  }

  if (comment.authorUserId === user.id) {
    res.status(400).json({ error: "Você não pode denunciar o próprio conteúdo." });
    return;
  }

  const parsed = ReportCommunityCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select({ id: communityReportsTable.id })
    .from(communityReportsTable)
    .where(
      and(
        eq(communityReportsTable.targetType, "comment"),
        eq(communityReportsTable.targetId, commentId),
        eq(communityReportsTable.reporterUserId, user.id),
        eq(communityReportsTable.status, "open")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Você já denunciou este conteúdo." });
    return;
  }

  await createCommunityReportAndNotify({
    clinicId: post.clinicId,
    reporterUserId: user.id,
    targetType: "comment",
    targetId: commentId,
    targetContent: [
      `Comentário: ${comment.content.trim() || `Arquivo anexado: ${comment.mediaName ?? "sem título"}`}`,
      `Publicação: ${post.content?.trim() || post.mediaName || "sem texto"}`,
    ].join("\n"),
    reason: parsed.data.reason?.trim(),
  });

  res.status(201).json({ success: true });
});

router.get("/community/reports", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (!canModerate(user.role)) {
    res.status(403).json({ error: "Apenas moderadores podem ver denúncias." });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.json([]);
    return;
  }

  const reports = await db
    .select()
    .from(communityReportsTable)
    .where(
      and(
        eq(communityReportsTable.clinicId, clinicId),
        eq(communityReportsTable.status, "open")
      )
    )
    .orderBy(desc(communityReportsTable.id));

  const results = await Promise.all(
    reports.map(async (report) => {
      const [reporter] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, report.reporterUserId))
        .limit(1);

      let targetContent: string | null = null;
      let targetAuthorName = "";

      let targetExists = false;
      let targetMediaUrl: string | null = null;
      let targetMediaType: string | null = null;

      if (report.targetType === "post") {
        const [post] = await db
          .select({
            content: communityPostsTable.content,
            mediaUrl: communityPostsTable.mediaUrl,
            mediaType: communityPostsTable.mediaType,
            authorUserId: communityPostsTable.authorUserId,
          })
          .from(communityPostsTable)
          .where(eq(communityPostsTable.id, report.targetId))
          .limit(1);
        if (post) {
          targetExists = true;
          targetContent = post.content;
          targetMediaUrl = post.mediaUrl;
          targetMediaType = post.mediaType;
          const [author] = await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, post.authorUserId))
            .limit(1);
          targetAuthorName = author?.name ?? "";
        }
      } else {
        const [comment] = await db
          .select({
            content: communityCommentsTable.content,
            mediaUrl: communityCommentsTable.mediaUrl,
            mediaType: communityCommentsTable.mediaType,
            mediaName: communityCommentsTable.mediaName,
            authorUserId: communityCommentsTable.authorUserId,
          })
          .from(communityCommentsTable)
          .where(eq(communityCommentsTable.id, report.targetId))
          .limit(1);
        if (comment) {
          targetExists = true;
          targetContent = comment.content || (comment.mediaName ? `Arquivo anexado: ${comment.mediaName}` : null);
          targetMediaUrl = comment.mediaUrl;
          targetMediaType = comment.mediaType;
          const [author] = await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, comment.authorUserId))
            .limit(1);
          targetAuthorName = author?.name ?? "";
        }
      }

      return {
        id: report.id,
        clinicId: report.clinicId,
        reporterUserId: report.reporterUserId,
        reporterName: reporter?.name ?? "",
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        targetExists,
        targetContent,
        targetMediaUrl,
        targetMediaType,
        targetAuthorName,
        createdAt: report.createdAt.toISOString(),
      };
    })
  );

  res.json(results);
});

router.post("/community/reports/:reportId/dismiss", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (!canModerate(user.role)) {
    res.status(403).json({ error: "Apenas moderadores podem dispensar denúncias." });
    return;
  }

  const reportId = parseInt(req.params.reportId, 10);
  if (Number.isNaN(reportId)) {
    res.status(400).json({ error: "reportId inválido" });
    return;
  }

  const [report] = await db
    .select()
    .from(communityReportsTable)
    .where(eq(communityReportsTable.id, reportId))
    .limit(1);
  if (!report) {
    res.status(404).json({ error: "Denúncia não encontrada" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== report.clinicId) {
    res.status(403).json({ error: "Esta denúncia não pertence à sua clínica." });
    return;
  }

  await db
    .update(communityReportsTable)
    .set({ status: "dismissed" })
    .where(eq(communityReportsTable.id, reportId));

  res.json({ success: true });
});

router.delete("/community/reports/:reportId/content", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (!canModerate(user.role)) {
    res.status(403).json({ error: "Apenas moderadores podem remover conteúdo denunciado." });
    return;
  }

  const reportId = parseInt(req.params.reportId, 10);
  if (Number.isNaN(reportId)) {
    res.status(400).json({ error: "reportId inválido" });
    return;
  }

  const [report] = await db
    .select()
    .from(communityReportsTable)
    .where(eq(communityReportsTable.id, reportId))
    .limit(1);
  if (!report) {
    res.status(404).json({ error: "Denúncia não encontrada" });
    return;
  }

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId !== report.clinicId) {
    res.status(403).json({ error: "Esta denúncia não pertence à sua clínica." });
    return;
  }

  let authorNotified = false;
  if (report.targetType === "post") {
    const [post] = await db
      .select()
      .from(communityPostsTable)
      .where(eq(communityPostsTable.id, report.targetId))
      .limit(1);
    if (post) {
      await db.delete(communityPostsTable).where(eq(communityPostsTable.id, report.targetId));
      publishToClinic(post.clinicId, { type: "post-deleted", postId: post.id });
    }
    await db
      .update(communityReportsTable)
      .set({ status: "dismissed" })
      .where(
        and(
          eq(communityReportsTable.targetType, "post"),
          eq(communityReportsTable.targetId, report.targetId)
        )
      );
  } else {
    const [comment] = await db
      .select()
      .from(communityCommentsTable)
      .where(eq(communityCommentsTable.id, report.targetId))
      .limit(1);
    if (comment) {
      const [parentPost] = await db
        .select()
        .from(communityPostsTable)
        .where(eq(communityPostsTable.id, comment.postId))
        .limit(1);
      await db.delete(communityCommentsTable).where(eq(communityCommentsTable.id, report.targetId));
      if (parentPost) {
        authorNotified = await notifyCommunityContentRemoved(
          comment.authorUserId,
          parentPost.clinicId,
          "comment",
          req.log
        );
        publishToClinic(parentPost.clinicId, { type: "comment-deleted", postId: comment.postId });
      }
    }
    await db
      .update(communityReportsTable)
      .set({ status: "dismissed" })
      .where(
        and(
          eq(communityReportsTable.targetType, "comment"),
          eq(communityReportsTable.targetId, report.targetId)
        )
      );
  }

  res.json({ success: true, authorNotified });
});

/**
 * GET /community/notification-preferences
 * Returns the caller's community notification mute preference for their
 * active clinic. Mute state is stored per (user, clinic) so a user who
 * belongs to multiple clinics can control each feed independently.
 */
router.get("/community/notification-preferences", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const [row] = await db
    .select({ userId: communityNotificationMutesTable.userId })
    .from(communityNotificationMutesTable)
    .where(
      and(
        eq(communityNotificationMutesTable.userId, user.id),
        eq(communityNotificationMutesTable.clinicId, clinicId)
      )
    )
    .limit(1);

  res.json({ muted: row !== undefined });
});

/**
 * PATCH /community/notification-preferences
 * Toggle the caller's community notification mute preference for their
 * active clinic. Inserts a row to mute, deletes it to unmute.
 */
router.patch("/community/notification-preferences", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const { muted } = req.body as { muted: boolean };
  if (typeof muted !== "boolean") {
    res.status(400).json({ error: "muted deve ser boolean" });
    return;
  }

  if (muted) {
    await db
      .insert(communityNotificationMutesTable)
      .values({ userId: user.id, clinicId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(communityNotificationMutesTable)
      .where(
        and(
          eq(communityNotificationMutesTable.userId, user.id),
          eq(communityNotificationMutesTable.clinicId, clinicId)
        )
      );
  }

  res.json({ muted });
});

/**
 * Server-Sent Events stream for real-time community feed updates.
 *
 * Broadcasts to every member of the caller's clinic (unlike the 1:1
 * conversations stream) — clients treat these as cache-invalidation signals
 * and refetch the relevant queries.
 *
 * EventSource cannot set an Authorization header, so auth is done via a
 * `?token=` query param (see `requireAuth`).
 */
router.get("/community/stream", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req, { allowQueryToken: true });
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const clinicId = await resolveCallerClinicId(user, authResult.clinicId);
  if (clinicId === null) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(": connected\n\n");

  subscribeToClinic(clinicId, res);

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribeFromClinic(clinicId, res);
  });
});

export default router;
