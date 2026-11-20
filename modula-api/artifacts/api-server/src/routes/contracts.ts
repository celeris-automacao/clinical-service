import { Router } from "express";
import { db } from "@workspace/db";
import {
  contractsTable,
  patientsTable,
  clinicOwnersTable,
} from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, isError, ensurePatientAccess, resolveOwnerClinicId } from "../lib/auth-helpers";
import { z } from "zod/v4";
import { ObjectStorageService } from "../lib/objectStorage";
import { randomUUID } from "crypto";

const router = Router();
const objectStorage = new ObjectStorageService();

// ─── Helper: resolve patient from any context ─────────────────────────────────

async function resolveContractAndCheckAccess(
  contractId: number,
  userId: number,
  role: string,
  clinicId?: number
) {
  const [contract] = await db
    .select()
    .from(contractsTable)
    .where(and(eq(contractsTable.id, contractId), ne(contractsTable.status, "deleted")))
    .limit(1);
  if (!contract) return { contract: null, allowed: false };

  if (role === "patient") {
    const [patient] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.id, contract.patientId))
      .limit(1);
    if (!patient || patient.userId !== userId) return { contract, allowed: false };
    return { contract, allowed: true };
  }

  if (role === "clinic_owner") {
    const effectiveClinicId = await resolveOwnerClinicId(userId, clinicId);
    if (effectiveClinicId === undefined) return { contract, allowed: false };
    return { contract, allowed: contract.clinicId === effectiveClinicId };
  }

  if (role === "profissional_saude" || role === "secretaria") {
    // Delegate to ensurePatientAccess which handles clinic-scoped checks
    const patientRecord = await ensurePatientAccess(
      { id: userId, role: role as any },
      contract.patientId,
      clinicId
    );
    return { contract, allowed: !!patientRecord };
  }

  return { contract, allowed: false };
}

function serializeContract(c: typeof contractsTable.$inferSelect) {
  return {
    ...c,
    signedAt: c.signedAt ? c.signedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// ─── List patient contracts ───────────────────────────────────────────────────

router.get("/patients/:patientId/contracts", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  const patientId = Number(req.params.patientId);

  const allowed = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const rows = await db
    .select()
    .from(contractsTable)
    .where(and(eq(contractsTable.patientId, patientId), ne(contractsTable.status, "deleted")));

  res.json(rows.map(serializeContract));
});

// ─── Create contract ──────────────────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(1),
  termsContent: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalValueCents: z.number().int().min(0),
});

router.post("/patients/:patientId/contracts", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas proprietários de clínica podem criar contratos" });
    return;
  }

  const patientId = Number(req.params.patientId);
  const allowed = await ensurePatientAccess(user, patientId, authResult.clinicId);
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.prettifyError(parsed.error) });
    return;
  }

  const clinicId = await resolveOwnerClinicId(user.id, authResult.clinicId);
  if (clinicId === undefined) {
    res.status(403).json({ error: "Clínica não encontrada" });
    return;
  }

  const [contract] = await db
    .insert(contractsTable)
    .values({
      clinicId,
      patientId,
      title: parsed.data.title,
      termsContent: parsed.data.termsContent,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      totalValueCents: parsed.data.totalValueCents,
    })
    .returning();

  res.status(201).json(serializeContract(contract!));
});

// ─── Get contract detail ──────────────────────────────────────────────────────

router.get("/contracts/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;
  const contractId = Number(req.params.id);

  const { contract, allowed } = await resolveContractAndCheckAccess(
    contractId,
    user.id,
    user.role,
    authResult.clinicId
  );

  if (!contract) {
    res.status(404).json({ error: "Contrato não encontrado" });
    return;
  }
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  res.json(serializeContract(contract));
});

// ─── Delete contract (soft) ───────────────────────────────────────────────────

router.delete("/contracts/:id", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role !== "clinic_owner") {
    res.status(403).json({ error: "Apenas proprietários de clínica podem excluir contratos" });
    return;
  }

  const contractId = Number(req.params.id);
  const { contract, allowed } = await resolveContractAndCheckAccess(
    contractId,
    user.id,
    user.role,
    authResult.clinicId
  );

  if (!contract) {
    res.status(404).json({ error: "Contrato não encontrado" });
    return;
  }
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }

  await db
    .update(contractsTable)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(eq(contractsTable.id, contractId));

  res.status(204).end();
});

// ─── Sign contract ────────────────────────────────────────────────────────────

const signSchema = z.object({
  signatureImageBase64: z.string().min(1),
});

router.post("/contracts/:id/sign", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  const { user } = authResult;

  if (user.role !== "patient") {
    res.status(403).json({ error: "Apenas pacientes podem assinar contratos" });
    return;
  }

  const contractId = Number(req.params.id);
  const { contract, allowed } = await resolveContractAndCheckAccess(
    contractId,
    user.id,
    user.role,
    authResult.clinicId
  );

  if (!contract) {
    res.status(404).json({ error: "Contrato não encontrado" });
    return;
  }
  if (!allowed) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  if (contract.status === "signed") {
    res.status(400).json({ error: "Contrato já foi assinado" });
    return;
  }

  const parsed = signSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.prettifyError(parsed.error) });
    return;
  }

  // Decode the base64 PNG and upload to object storage.
  // Only image/png is accepted — SVG and other active-content types are rejected.
  let signatureImageUrl: string;
  try {
    const raw = parsed.data.signatureImageBase64;

    // Parse data URL: data:<mime>;base64,<data>
    const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/s);
    if (!dataUrlMatch) {
      res.status(400).json({ error: "Formato de imagem inválido. Esperado data URL base64." });
      return;
    }

    const mimeType = dataUrlMatch[1];
    if (mimeType !== "image/png") {
      res.status(400).json({ error: "Apenas imagens PNG são aceitas para assinatura." });
      return;
    }

    const base64Payload = dataUrlMatch[2];
    const imageBuffer = Buffer.from(base64Payload, "base64");

    if (imageBuffer.length < 8) {
      res.status(400).json({ error: "Imagem de assinatura vazia." });
      return;
    }

    // Validate PNG magic bytes: \x89PNG\r\n\x1a\n
    const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const isPng = PNG_MAGIC.every((byte, i) => imageBuffer[i] === byte);
    if (!isPng) {
      res.status(400).json({ error: "Imagem inválida: o arquivo não é um PNG válido." });
      return;
    }

    const objectId = randomUUID();
    signatureImageUrl = `/objects/signatures/${objectId}.png`;
    await objectStorage.saveObjectEntity(signatureImageUrl, imageBuffer, "image/png");
  } catch (err) {
    req.log.error({ err }, "Failed to upload signature image");
    res.status(500).json({ error: "Falha ao salvar imagem da assinatura" });
    return;
  }

  const [updated] = await db
    .update(contractsTable)
    .set({
      status: "signed",
      signatureImageUrl,
      signedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(contractsTable.id, contractId))
    .returning();

  res.json(serializeContract(updated!));
});

export default router;
