import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { raw, Router } from "express";
import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import {
  db,
  conversationsTable,
  messagesTable,
  patientsTable,
  doctorsTable,
  usersTable,
  patientDoctorsTable,
  patientClinicsTable,
  clinicOwnersTable,
  type MessageAttachment,
} from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId, resolveSecretaryClinicId } from "../lib/auth-helpers";
import { subscribe, unsubscribe, publishToUser } from "../lib/sse-hub";
import { CreateConversationBody, SendMessageBody } from "@workspace/api-zod";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { usesDiskStorage } from "../lib/diskStorage";

const router = Router();
const objectStorageService = new ObjectStorageService();
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const MAX_MESSAGE_ATTACHMENTS = 5;
const MessageAttachmentSchema = SendMessageBody.shape.attachments.unwrap().element;

function getLocalAttachmentFilePath(objectPath: string): string | null {
  const match = /^\/local-attachments\/\d+\/\d+\/([0-9a-f-]{36})$/i.exec(objectPath);
  if (!match) return null;
  const root = process.env.LOCAL_UPLOAD_DIR || path.resolve(process.cwd(), ".local-uploads");
  return path.join(root, match[1]);
}

function sanitizeAttachmentName(rawName: string | undefined): string | null {
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

function isValidContentType(contentType: string): boolean {
  return contentType.length <= 255 && /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(contentType);
}

function attachmentPathPrefix(conversationId: number, userId: number): string {
  return usesDiskStorage() || process.env.PRIVATE_OBJECT_DIR
    ? `/objects/chat-attachments/${conversationId}/${userId}/`
    : `/local-attachments/${conversationId}/${userId}/`;
}

async function attachmentExists(attachment: MessageAttachment): Promise<boolean> {
  try {
    const localPath = getLocalAttachmentFilePath(attachment.path);
    if (localPath) {
      const fileStat = await stat(localPath);
      return fileStat.isFile() && fileStat.size === attachment.size;
    }
    const file = await objectStorageService.getObjectEntityFile(attachment.path);
    const [metadata] = await file.getMetadata();
    return Number(metadata.size) === attachment.size;
  } catch (error) {
    if (error instanceof ObjectNotFoundError) return false;
    throw error;
  }
}

type ParticipantInfo = {
  userId: number;
  name: string;
  avatarUrl: string | null;
  role: string;
  patientId: number | null;
  doctorId: number | null;
};

/** Order two user ids so the lower one is always "A" — keeps the pair unique regardless of call order. */
function orderParticipants(userIdA: number, userIdB: number): [number, number] {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
}

async function getPatientRecordForUser(userId: number) {
  const [p] = await db.select().from(patientsTable).where(eq(patientsTable.userId, userId)).limit(1);
  return p;
}

async function getDoctorRecordForUser(userId: number) {
  const [d] = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, userId)).limit(1);
  return d;
}

async function getParticipantInfo(userId: number): Promise<ParticipantInfo> {
  const [userRow] = await db
    .select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const [patientRow] = await db
    .select({ id: patientsTable.id })
    .from(patientsTable)
    .where(eq(patientsTable.userId, userId))
    .limit(1);
  const [doctorRow] = await db
    .select({ id: doctorsTable.id })
    .from(doctorsTable)
    .where(eq(doctorsTable.userId, userId))
    .limit(1);

  return {
    userId,
    name: userRow?.name ?? "",
    avatarUrl: userRow?.avatarUrl ?? null,
    role: userRow?.role ?? "patient",
    patientId: patientRow?.id ?? null,
    doctorId: doctorRow?.id ?? null,
  };
}

/**
 * Verify that a patient and a doctor may talk to each other:
 * the doctor must be assigned to the patient AND the patient must be enrolled
 * in the doctor's clinic (fail-closed, mirrors ensurePatientAccess semantics).
 */
async function verifyPatientDoctorLink(patientId: number, doctorId: number): Promise<{ clinicId: number } | null> {
  const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
  if (!doctor) return null;

  const [assignment] = await db
    .select()
    .from(patientDoctorsTable)
    .where(and(eq(patientDoctorsTable.patientId, patientId), eq(patientDoctorsTable.doctorId, doctorId)))
    .limit(1);
  if (!assignment) return null;

  const [enrollment] = await db
    .select()
    .from(patientClinicsTable)
    .where(and(eq(patientClinicsTable.patientId, patientId), eq(patientClinicsTable.clinicId, doctor.clinicId)))
    .limit(1);
  if (!enrollment) return null;

  return { clinicId: doctor.clinicId };
}

/**
 * Verify a target user (by users.id) belongs to the given clinic, as a doctor,
 * clinic owner, or enrolled patient. Returns null if not a valid, clinic-scoped
 * recipient.
 */
async function verifyClinicMembership(
  targetUserId: number,
  clinicId: number
): Promise<{ role: string } | null> {
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
  if (!targetUser || targetUser.deactivatedAt !== null) return null;

  if (targetUser.role === "profissional_saude") {
    const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, targetUserId)).limit(1);
    return doctor && doctor.clinicId === clinicId ? { role: "profissional_saude" } : null;
  }

  if (targetUser.role === "clinic_owner") {
    const [ownership] = await db
      .select()
      .from(clinicOwnersTable)
      .where(and(eq(clinicOwnersTable.userId, targetUserId), eq(clinicOwnersTable.clinicId, clinicId)))
      .limit(1);
    return ownership ? { role: "clinic_owner" } : null;
  }

  if (targetUser.role === "patient") {
    const patient = await getPatientRecordForUser(targetUserId);
    if (!patient) return null;
    const [enrollment] = await db
      .select()
      .from(patientClinicsTable)
      .where(and(eq(patientClinicsTable.patientId, patient.id), eq(patientClinicsTable.clinicId, clinicId)))
      .limit(1);
    return enrollment ? { role: "patient" } : null;
  }

  return null;
}

/**
 * Verify the caller may access the given conversation.
 * - secretaria: any conversation within her own clinic (full clinic visibility).
 * - everyone else: must be one of the two participants.
 */
async function ensureConversationAccess(
  user: { id: number; role: string },
  conversationId: number
): Promise<typeof conversationsTable.$inferSelect | null> {
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId))
    .limit(1);
  if (!conversation) return null;

  if (user.role === "secretaria") {
    const clinicId = await resolveSecretaryClinicId(user.id);
    return clinicId !== undefined && clinicId === conversation.clinicId ? conversation : null;
  }

  const isParticipant =
    conversation.participantAUserId === user.id || conversation.participantBUserId === user.id;
  return isParticipant ? conversation : null;
}

async function buildConversationResponse(conversation: typeof conversationsTable.$inferSelect, viewerUserId: number) {
  const [infoA, infoB] = await Promise.all([
    getParticipantInfo(conversation.participantAUserId),
    getParticipantInfo(conversation.participantBUserId),
  ]);

  const patientInfo = infoA.patientId !== null ? infoA : infoB.patientId !== null ? infoB : null;
  const doctorInfo = infoA.doctorId !== null ? infoA : infoB.doctorId !== null ? infoB : null;
  // Viewer is normally one of the two participants, so "other" is simply the
  // counterpart. Non-participant viewers (e.g. secretaria browsing clinic-wide
  // threads) aren't on either side, so there's no true "other" from their
  // perspective — fall back to the patient side for legacy patient/doctor
  // threads (matching what the doctor themself would see), or participant A
  // for genuinely generic threads where neither side is a patient.
  const other =
    infoA.userId === viewerUserId ? infoB : infoB.userId === viewerUserId ? infoA : (patientInfo ?? infoA);

  const [lastMessage] = await db
    .select({ content: messagesTable.content, attachments: messagesTable.attachments })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(desc(messagesTable.id))
    .limit(1);

  const [unreadRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.conversationId, conversation.id),
        isNull(messagesTable.readAt),
        ne(messagesTable.senderId, viewerUserId)
      )
    );

  return {
    id: conversation.id,
    clinicId: conversation.clinicId,
    patientId: patientInfo?.patientId ?? null,
    doctorId: doctorInfo?.doctorId ?? null,
    patientName: patientInfo?.name ?? null,
    doctorName: doctorInfo?.name ?? null,
    patientAvatarUrl: patientInfo?.avatarUrl ?? null,
    doctorAvatarUrl: doctorInfo?.avatarUrl ?? null,
    participantA: { userId: infoA.userId, name: infoA.name, avatarUrl: infoA.avatarUrl, role: infoA.role },
    participantB: { userId: infoB.userId, name: infoB.name, avatarUrl: infoB.avatarUrl, role: infoB.role },
    otherParticipant: { userId: other.userId, name: other.name, avatarUrl: other.avatarUrl, role: other.role },
    lastMessagePreview: lastMessage?.content || (lastMessage?.attachments.length ? "📎 Anexo" : null),
    unreadCount: Number(unreadRow?.count ?? 0),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
  };
}

router.get("/conversations", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  let rows: (typeof conversationsTable.$inferSelect)[] = [];
  if (user.role === "secretaria") {
    const clinicId = await resolveSecretaryClinicId(user.id, authResult.clinicId);
    if (clinicId === undefined) {
      res.json([]);
      return;
    }
    rows = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.clinicId, clinicId))
      .orderBy(desc(conversationsTable.lastMessageAt));
  } else if (
    user.role === "patient" ||
    user.role === "profissional_saude" ||
    user.role === "clinic_owner"
  ) {
    rows = await db
      .select()
      .from(conversationsTable)
      .where(
        sql`${conversationsTable.participantAUserId} = ${user.id} OR ${conversationsTable.participantBUserId} = ${user.id}`
      )
      .orderBy(desc(conversationsTable.lastMessageAt));
  } else {
    res
      .status(403)
      .json({ error: "Chat disponível apenas para pacientes, profissionais de saúde, donos de clínica e secretárias." });
    return;
  }

  const results = await Promise.all(rows.map((c) => buildConversationResponse(c, user.id)));
  res.json(results);
});

router.get("/conversations/recipients", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role === "profissional_saude") {
    const doctor = await getDoctorRecordForUser(user.id);
    if (!doctor) {
      res.json({ doctors: [], owners: [], patients: [] });
      return;
    }
    const patientRows = await db
      .select({ userId: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(patientDoctorsTable)
      .innerJoin(patientsTable, eq(patientsTable.id, patientDoctorsTable.patientId))
      .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
      .where(and(eq(patientDoctorsTable.doctorId, doctor.id), isNull(usersTable.deactivatedAt)));
    res.json({
      doctors: [],
      owners: [],
      patients: patientRows.map((r) => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, role: "patient" })),
    });
    return;
  }

  if (user.role !== "secretaria" && user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas secretárias, profissionais de saúde e donos de clínica podem listar destinatários." });
    return;
  }

  const clinicId =
    user.role === "clinic_owner"
      ? await resolveOwnerClinicId(user.id, authResult.clinicId)
      : await resolveSecretaryClinicId(user.id, authResult.clinicId);
  if (clinicId === undefined) {
    res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
    return;
  }

  const doctorRows = await db
    .select({ userId: doctorsTable.userId, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(and(eq(doctorsTable.clinicId, clinicId), isNull(usersTable.deactivatedAt)));

  const ownerRows = await db
    .select({ userId: clinicOwnersTable.userId, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(clinicOwnersTable)
    .innerJoin(usersTable, eq(usersTable.id, clinicOwnersTable.userId))
    .where(and(eq(clinicOwnersTable.clinicId, clinicId), isNull(usersTable.deactivatedAt)));

  const patientRows = await db
    .select({ userId: patientsTable.userId, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(patientClinicsTable)
    .innerJoin(patientsTable, eq(patientsTable.id, patientClinicsTable.patientId))
    .innerJoin(usersTable, eq(usersTable.id, patientsTable.userId))
    .where(and(eq(patientClinicsTable.clinicId, clinicId), isNull(usersTable.deactivatedAt)));

  res.json({
    doctors: doctorRows.map((r) => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, role: "profissional_saude" })),
    owners: ownerRows.map((r) => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, role: "clinic_owner" })),
    patients: patientRows.map((r) => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl, role: "patient" })),
  });
});

router.post("/conversations", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let participantAUserId: number;
  let participantBUserId: number;
  let clinicId: number;

  if (user.role === "patient") {
    if (!parsed.data.doctorId) {
      res.status(400).json({ error: "doctorId é obrigatório" });
      return;
    }
    const patient = await getPatientRecordForUser(user.id);
    if (!patient) {
      res.status(404).json({ error: "Registro de paciente não encontrado" });
      return;
    }
    const link = await verifyPatientDoctorLink(patient.id, parsed.data.doctorId);
    if (!link) {
      res.status(403).json({ error: "Este profissional não atende este paciente." });
      return;
    }
    const doctorRecord = await db.select().from(doctorsTable).where(eq(doctorsTable.id, parsed.data.doctorId)).limit(1);
    [participantAUserId, participantBUserId] = orderParticipants(user.id, doctorRecord[0].userId);
    clinicId = link.clinicId;
  } else if (user.role === "profissional_saude") {
    const doctor = await getDoctorRecordForUser(user.id);
    if (!doctor) {
      res.status(404).json({ error: "Registro de profissional não encontrado" });
      return;
    }
    if (parsed.data.patientId) {
      const link = await verifyPatientDoctorLink(parsed.data.patientId, doctor.id);
      if (!link) {
        res.status(403).json({ error: "Este profissional não atende este paciente." });
        return;
      }
      const patientRecord = await db.select().from(patientsTable).where(eq(patientsTable.id, parsed.data.patientId)).limit(1);
      [participantAUserId, participantBUserId] = orderParticipants(user.id, patientRecord[0].userId);
      clinicId = link.clinicId;
    } else if (parsed.data.otherUserId) {
      if (parsed.data.otherUserId === user.id) {
        res.status(400).json({ error: "Não é possível iniciar uma conversa consigo mesmo." });
        return;
      }
      const membership = await verifyClinicMembership(parsed.data.otherUserId, doctor.clinicId);
      if (!membership) {
        res.status(403).json({ error: "Esta pessoa não pertence à sua clínica." });
        return;
      }
      if (membership.role === "patient") {
        const targetPatient = await getPatientRecordForUser(parsed.data.otherUserId);
        const link = targetPatient ? await verifyPatientDoctorLink(targetPatient.id, doctor.id) : null;
        if (!link) {
          res.status(403).json({ error: "Este profissional não atende este paciente." });
          return;
        }
      }
      clinicId = doctor.clinicId;
      [participantAUserId, participantBUserId] = orderParticipants(user.id, parsed.data.otherUserId);
    } else {
      res.status(400).json({ error: "Informe otherUserId ou patientId." });
      return;
    }
  } else if (user.role === "secretaria") {
    const mySecretaryClinicId = await resolveSecretaryClinicId(user.id, authResult.clinicId);
    if (mySecretaryClinicId === undefined) {
      res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
      return;
    }
    clinicId = mySecretaryClinicId;

    if (parsed.data.otherUserId) {
      const membership = await verifyClinicMembership(parsed.data.otherUserId, clinicId);
      if (!membership) {
        res.status(403).json({ error: "Este destinatário não pertence à sua clínica." });
        return;
      }
      [participantAUserId, participantBUserId] = orderParticipants(user.id, parsed.data.otherUserId);
    } else if (parsed.data.patientId && parsed.data.doctorId) {
      // Legacy path: create/open the underlying patient-doctor conversation itself.
      const [targetDoctor] = await db
        .select()
        .from(doctorsTable)
        .where(eq(doctorsTable.id, parsed.data.doctorId))
        .limit(1);
      if (!targetDoctor || targetDoctor.clinicId !== clinicId) {
        res.status(403).json({ error: "Este profissional não pertence à sua clínica." });
        return;
      }
      const link = await verifyPatientDoctorLink(parsed.data.patientId, parsed.data.doctorId);
      if (!link) {
        res.status(403).json({ error: "Este profissional não atende este paciente." });
        return;
      }
      const [patientRecord] = await db
        .select()
        .from(patientsTable)
        .where(eq(patientsTable.id, parsed.data.patientId))
        .limit(1);
      [participantAUserId, participantBUserId] = orderParticipants(patientRecord.userId, targetDoctor.userId);
    } else {
      res.status(400).json({ error: "Informe otherUserId, ou patientId e doctorId." });
      return;
    }
  } else if (user.role === "clinic_owner") {
    if (!parsed.data.otherUserId) {
      res.status(400).json({ error: "otherUserId é obrigatório" });
      return;
    }
    if (parsed.data.otherUserId === user.id) {
      res.status(400).json({ error: "Não é possível iniciar uma conversa consigo mesmo." });
      return;
    }
    const ownerClinicId = await resolveOwnerClinicId(user.id, authResult.clinicId);
    if (ownerClinicId === undefined) {
      res.status(403).json({ error: "Usuário não vinculado a nenhuma clínica." });
      return;
    }
    const membership = await verifyClinicMembership(parsed.data.otherUserId, ownerClinicId);
    if (!membership) {
      res.status(403).json({ error: "Esta pessoa não pertence à sua clínica." });
      return;
    }
    clinicId = ownerClinicId;
    [participantAUserId, participantBUserId] = orderParticipants(user.id, parsed.data.otherUserId);
  } else {
    res
      .status(403)
      .json({ error: "Apenas pacientes, profissionais de saúde, donos de clínica e secretárias podem iniciar conversas." });
    return;
  }

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.participantAUserId, participantAUserId),
        eq(conversationsTable.participantBUserId, participantBUserId),
        eq(conversationsTable.clinicId, clinicId)
      )
    )
    .limit(1);

  const conversation =
    existing ??
    (
      await db
        .insert(conversationsTable)
        .values({ participantAUserId, participantBUserId, clinicId })
        .onConflictDoNothing()
        .returning()
    )[0] ??
    (
      await db
        .select()
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.participantAUserId, participantAUserId),
            eq(conversationsTable.participantBUserId, participantBUserId),
            eq(conversationsTable.clinicId, clinicId)
          )
        )
        .limit(1)
    )[0];

  const result = await buildConversationResponse(conversation, user.id);
  res.status(existing ? 200 : 201).json(result);
});

router.get("/conversations/unread-count", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  let conversationIds: number[] = [];
  if (user.role === "secretaria") {
    const clinicId = await resolveSecretaryClinicId(user.id, authResult.clinicId);
    if (clinicId !== undefined) {
      const rows = await db
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(eq(conversationsTable.clinicId, clinicId));
      conversationIds = rows.map((r) => r.id);
    }
  } else if (user.role === "patient" || user.role === "profissional_saude" || user.role === "clinic_owner") {
    const rows = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(
        sql`${conversationsTable.participantAUserId} = ${user.id} OR ${conversationsTable.participantBUserId} = ${user.id}`
      );
    conversationIds = rows.map((r) => r.id);
  }

  if (conversationIds.length === 0) {
    res.json({ count: 0 });
    return;
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .where(
      and(
        inArray(messagesTable.conversationId, conversationIds),
        isNull(messagesTable.readAt),
        ne(messagesTable.senderId, user.id)
      )
    );

  res.json({ count: Number(row?.count ?? 0) });
});

/**
 * Server-Sent Events stream for real-time chat updates.
 *
 * Fired with `{ type: "message", conversationId }` when a new message is sent
 * in any conversation the caller participates in, and `{ type: "read",
 * conversationId }` when the other participant reads a conversation. Clients
 * treat these as cache-invalidation signals — they refetch the relevant
 * queries (messages, conversations list, unread count) rather than trying to
 * reconstruct state purely from the event payload.
 *
 * EventSource cannot set an Authorization header, so auth is done via a
 * `?token=` query param (see `requireAuth`).
 */
router.get("/conversations/stream", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req, { allowQueryToken: true });
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(": connected\n\n");

  subscribe(user.id, res);

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe(user.id, res);
  });
});

router.get("/conversations/:conversationId/messages", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const conversationId = Number(req.params.conversationId);
  const conversation = await ensureConversationAccess(user, conversationId);
  if (!conversation) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;

  const conditions = [eq(messagesTable.conversationId, conversationId)];
  if (beforeId) {
    conditions.push(lt(messagesTable.id, beforeId));
  }

  const rows = await db
    .select({ message: messagesTable, senderRole: usersTable.role })
    .from(messagesTable)
    .innerJoin(usersTable, eq(usersTable.id, messagesTable.senderId))
    .where(and(...conditions))
    .orderBy(desc(messagesTable.id))
    .limit(limit);

  const ordered = rows.reverse();

  res.json(
    ordered.map(({ message, senderRole }) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole,
      content: message.content,
      attachments: message.attachments,
      readAt: message.readAt ? message.readAt.toISOString() : null,
      createdAt: message.createdAt.toISOString(),
    }))
  );
});

router.post(
  "/conversations/:conversationId/attachments",
  raw({ type: () => true, limit: MAX_ATTACHMENT_SIZE }),
  async (req, res): Promise<void> => {
    const authResult = await requireAuth(req);
    if (isError(authResult)) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }
    const { user } = authResult;
    const conversationId = Number(req.params.conversationId);
    const conversation = await ensureConversationAccess(user, conversationId);
    if (!conversation) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > MAX_ATTACHMENT_SIZE) {
      res.status(400).json({ error: "Arquivo vazio ou maior que o limite de 50 MB." });
      return;
    }

    const name = sanitizeAttachmentName(req.get("x-file-name"));
    const contentType = (req.get("x-file-content-type") || "application/octet-stream").trim();
    if (!name || !isValidContentType(contentType)) {
      res.status(400).json({ error: "Nome ou tipo do arquivo inválido." });
      return;
    }

    const fileId = randomUUID();
    try {
      let objectPath: string;
      if (usesDiskStorage() || process.env.PRIVATE_OBJECT_DIR) {
        objectPath = `${attachmentPathPrefix(conversationId, user.id)}${fileId}`;
        await objectStorageService.saveObjectEntity(objectPath, req.body, contentType);
      } else if (process.env.NODE_ENV !== "production") {
        const localPath = getLocalAttachmentFilePath(
          `/local-attachments/${conversationId}/${user.id}/${fileId}`
        );
        if (!localPath) throw new Error("Failed to create a safe local attachment path");
        await mkdir(path.dirname(localPath), { recursive: true });
        await writeFile(localPath, req.body, { flag: "wx" });
        objectPath = `/local-attachments/${conversationId}/${user.id}/${fileId}`;
      } else {
        res.status(503).json({ error: "Armazenamento de arquivos não configurado." });
        return;
      }

      const attachment = MessageAttachmentSchema.parse({
        path: objectPath,
        name,
        contentType,
        size: req.body.length,
      });
      res.status(201).json(attachment);
    } catch (error) {
      req.log.error({ err: error, conversationId }, "Failed to store conversation attachment");
      res.status(500).json({ error: "Não foi possível salvar o arquivo." });
    }
  }
);

router.get(
  "/conversations/:conversationId/messages/:messageId/attachments/:attachmentIndex",
  async (req, res): Promise<void> => {
    const authResult = await requireAuth(req);
    if (isError(authResult)) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }
    const conversationId = Number(req.params.conversationId);
    const messageId = Number(req.params.messageId);
    const attachmentIndex = Number(req.params.attachmentIndex);
    const conversation = await ensureConversationAccess(authResult.user, conversationId);
    if (!conversation) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0) {
      res.status(400).json({ error: "Índice de anexo inválido." });
      return;
    }

    const [message] = await db
      .select({ attachments: messagesTable.attachments })
      .from(messagesTable)
      .where(and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, conversationId)))
      .limit(1);
    const attachment = message?.attachments[attachmentIndex];
    if (!attachment) {
      res.status(404).json({ error: "Arquivo não encontrado." });
      return;
    }

    try {
      const localPath = getLocalAttachmentFilePath(attachment.path);
      const isInline = attachment.contentType.startsWith("image/") || attachment.contentType.startsWith("video/");
      res.set({
        "Content-Type": attachment.contentType,
        "Content-Length": String(attachment.size),
        "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });

      if (localPath) {
        const fileStat = await stat(localPath);
        if (!fileStat.isFile() || fileStat.size !== attachment.size) {
          res.status(404).json({ error: "Arquivo não encontrado." });
          return;
        }
        const stream = createReadStream(localPath);
        stream.on("error", (error) => {
          req.log.error({ err: error, messageId }, "Failed to read local message attachment");
          if (!res.headersSent) res.status(500).json({ error: "Não foi possível ler o arquivo." });
          else res.destroy(error);
        });
        stream.pipe(res);
        return;
      }

      const file = await objectStorageService.getObjectEntityFile(attachment.path);
      const stream = file.createReadStream();
      stream.on("error", (error) => {
        req.log.error({ err: error, messageId }, "Failed to read message attachment from object storage");
        if (!res.headersSent) res.status(500).json({ error: "Não foi possível ler o arquivo." });
        else res.destroy(error);
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Arquivo não encontrado." });
        return;
      }
      req.log.error({ err: error, messageId }, "Failed to download conversation attachment");
      res.status(500).json({ error: "Não foi possível baixar o arquivo." });
    }
  }
);

router.post("/conversations/:conversationId/messages", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const conversationId = Number(req.params.conversationId);
  const conversation = await ensureConversationAccess(user, conversationId);
  if (!conversation) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const content = parsed.data.content?.trim() ?? "";
  const attachments = parsed.data.attachments ?? [];
  if (!content && attachments.length === 0) {
    res.status(400).json({ error: "Escreva uma mensagem ou anexe pelo menos um arquivo." });
    return;
  }
  if (attachments.length > MAX_MESSAGE_ATTACHMENTS) {
    res.status(400).json({ error: "É permitido anexar até 5 arquivos por mensagem." });
    return;
  }
  const expectedPrefix = attachmentPathPrefix(conversationId, user.id);
  for (const attachment of attachments) {
    if (!attachment.path.startsWith(expectedPrefix) || !(await attachmentExists(attachment))) {
      res.status(400).json({ error: "Um dos arquivos não foi enviado para esta conversa." });
      return;
    }
  }

  const [inserted] = await db
    .insert(messagesTable)
    .values({ conversationId, senderId: user.id, content, attachments })
    .returning();

  await db
    .update(conversationsTable)
    .set({ lastMessageAt: inserted.createdAt })
    .where(eq(conversationsTable.id, conversationId));

  const participantUserIds = [conversation.participantAUserId, conversation.participantBUserId];
  for (const participantUserId of participantUserIds) {
    publishToUser(participantUserId, { type: "message", conversationId });
  }

  res.status(201).json({
    id: inserted.id,
    conversationId: inserted.conversationId,
    senderId: inserted.senderId,
    senderRole: user.role,
    content: inserted.content,
    attachments: inserted.attachments,
    readAt: null,
    createdAt: inserted.createdAt.toISOString(),
  });
});

router.post("/conversations/:conversationId/read", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  const conversationId = Number(req.params.conversationId);
  const conversation = await ensureConversationAccess(user, conversationId);
  if (!conversation) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  await db
    .update(messagesTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messagesTable.conversationId, conversationId),
        isNull(messagesTable.readAt),
        ne(messagesTable.senderId, user.id)
      )
    );

  const participantUserIds = [conversation.participantAUserId, conversation.participantBUserId];
  for (const participantUserId of participantUserIds) {
    if (participantUserId === user.id) continue;
    publishToUser(participantUserId, { type: "read", conversationId });
  }

  res.json({ success: true });
});

export default router;
