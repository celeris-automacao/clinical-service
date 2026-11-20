import { Router } from "express";
import { eq, and, count, sql, inArray, isNull } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import {
  db,
  carePackagesTable,
  carePackageSlotsTable,
  patientPackagesTable,
  patientPackageDoctorsTable,
  patientDoctorsTable,
  doctorsTable,
  usersTable,
  clinicOwnersTable,
  patientClinicsTable,
  clinicsTable,
  clinicSettingsTable,
  clinicPublicPagesTable,
  clinicGalleryPhotosTable,
  carePackagePromotionUploadsTable,
  leadsTable,
} from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId, resolveSecretaryClinicId } from "../lib/auth-helpers";
import { isValidStorageObjectPath } from "../lib/storage-access";
import { ApiError } from "../middlewares/errorHandler";
import { z } from "zod/v4";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

async function requireOwner(req: Parameters<typeof requireAuth>[0]) {
  const authResult = await requireAuth(req);
  if (isError(authResult)) return authResult;
  if (authResult.user.role !== "clinic_owner") {
    return { status: 403 as const, error: "Acesso restrito ao dono da clínica" };
  }
  const clinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (!clinicId) return { status: 403 as const, error: "Clínica não encontrada" };
  return { user: authResult.user, clinicId };
}

async function requirePackageReader(req: Parameters<typeof requireAuth>[0]) {
  const authResult = await requireAuth(req);
  if (isError(authResult)) return authResult;
  if (authResult.user.role === "clinic_owner") {
    const clinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
    if (!clinicId) return { status: 403 as const, error: "Clínica não encontrada" };
    return { user: authResult.user, clinicId };
  }
  if (authResult.user.role === "secretaria") {
    const clinicId = await resolveSecretaryClinicId(authResult.user.id, authResult.clinicId);
    if (!clinicId) return { status: 403 as const, error: "Clínica não encontrada" };
    return { user: authResult.user, clinicId };
  }
  return { status: 403 as const, error: "Acesso restrito à clínica" };
}

function isOwnerError(v: unknown): v is { status: number; error: string } {
  return typeof v === "object" && v !== null && "error" in v;
}

async function getPackageWithSlots(packageId: number) {
  const [pkg] = await db.select().from(carePackagesTable).where(eq(carePackagesTable.id, packageId)).limit(1);
  if (!pkg) return null;
  const slots = await db.select().from(carePackageSlotsTable).where(eq(carePackageSlotsTable.packageId, packageId));
  return { ...pkg, slots };
}

function buildPackageDetailResponse(pkg: typeof carePackagesTable.$inferSelect & { slots: (typeof carePackageSlotsTable.$inferSelect)[] }) {
  return {
    id: pkg.id,
    clinicId: pkg.clinicId,
    name: pkg.name,
    description: pkg.description ?? null,
    durationDays: pkg.durationDays,
    priceCents: pkg.priceCents,
    originalPriceCents: pkg.originalPriceCents,
    active: pkg.active,
    promotionImages: pkg.promotionImages,
    slots: pkg.slots.map((s) => ({
      id: s.id,
      packageId: s.packageId,
      doctorId: s.doctorId,
      specialty: s.specialty,
      quantity: s.quantity,
    })),
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
}

type PackageSlotInput = { doctorId?: number; specialty: string; quantity: number };

async function normalizePackageSlots(slots: PackageSlotInput[], clinicId: number) {
  const doctorIds = [...new Set(slots.flatMap((slot) => slot.doctorId === undefined ? [] : [slot.doctorId]))];
  const doctors = doctorIds.length > 0
    ? await db.select({ id: doctorsTable.id, specialty: doctorsTable.specialty })
      .from(doctorsTable)
      .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
      .where(and(
        inArray(doctorsTable.id, doctorIds),
        eq(doctorsTable.clinicId, clinicId),
        isNull(usersTable.deactivatedAt),
      ))
    : [];
  if (doctors.length !== doctorIds.length) return null;

  const specialties = new Map(doctors.map((doctor) => [doctor.id, doctor.specialty]));
  return slots.map((slot) => ({
    doctorId: slot.doctorId ?? null,
    specialty: slot.doctorId === undefined ? slot.specialty : specialties.get(slot.doctorId)!,
    quantity: slot.quantity,
  }));
}

async function getAllowedPromotionImages(
  paths: string[],
  clinicId: number,
  existingPaths: string[] = [],
): Promise<Set<string>> {
  const allowed = new Set(paths.filter((path) => existingPaths.includes(path)));
  const newPaths = paths.filter((path) => !allowed.has(path));
  if (newPaths.length === 0) return allowed;

  const [publicPage] = await db.select({
    coverImageUrl: clinicPublicPagesTable.coverImageUrl,
  }).from(clinicPublicPagesTable).where(and(
    eq(clinicPublicPagesTable.clinicId, clinicId),
    eq(clinicPublicPagesTable.published, true),
  )).limit(1);
  if (publicPage?.coverImageUrl && newPaths.includes(publicPage.coverImageUrl)) {
    allowed.add(publicPage.coverImageUrl);
  }

  const galleryPhotos = publicPage
    ? await db.select({ url: clinicGalleryPhotosTable.url })
      .from(clinicGalleryPhotosTable)
      .where(and(
        eq(clinicGalleryPhotosTable.clinicId, clinicId),
        inArray(clinicGalleryPhotosTable.url, newPaths),
      ))
    : [];
  for (const photo of galleryPhotos) allowed.add(photo.url);

  const uploadedImages = await db.select({
    objectPath: carePackagePromotionUploadsTable.objectPath,
  }).from(carePackagePromotionUploadsTable).where(and(
    eq(carePackagePromotionUploadsTable.clinicId, clinicId),
    inArray(carePackagePromotionUploadsTable.objectPath, newPaths),
    inArray(carePackagePromotionUploadsTable.contentType, ["image/jpeg", "image/png", "image/webp"]),
  ));
  for (const image of uploadedImages) allowed.add(image.objectPath);
  return allowed;
}

export function isUniqueEnrollmentViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return "code" in err && (err as { code?: unknown }).code === "23505";
}

async function buildEnrollmentResponse(enrollment: typeof patientPackagesTable.$inferSelect) {
  const pkg = await db.select({ name: carePackagesTable.name }).from(carePackagesTable).where(eq(carePackagesTable.id, enrollment.packageId)).limit(1);
  const packageName = pkg[0]?.name ?? "";

  const doctorRows = await db
    .select({
      slotId: patientPackageDoctorsTable.slotId,
      doctorId: patientPackageDoctorsTable.doctorId,
      doctorName: usersTable.name,
      specialty: carePackageSlotsTable.specialty,
    })
    .from(patientPackageDoctorsTable)
    .innerJoin(doctorsTable, eq(doctorsTable.id, patientPackageDoctorsTable.doctorId))
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .innerJoin(carePackageSlotsTable, eq(carePackageSlotsTable.id, patientPackageDoctorsTable.slotId))
    .where(eq(patientPackageDoctorsTable.patientPackageId, enrollment.id));

  return {
    id: enrollment.id,
    patientId: enrollment.patientId,
    packageId: enrollment.packageId,
    packageName,
    clinicId: enrollment.clinicId,
    startDate: enrollment.startDate,
    endDate: enrollment.endDate,
    status: enrollment.status,
    doctors: doctorRows.map((d) => ({
      slotId: d.slotId,
      doctorId: d.doctorId,
      doctorName: d.doctorName,
      specialty: d.specialty,
    })),
    createdAt: enrollment.createdAt.toISOString(),
  };
}

// ── GET /packages ─────────────────────────────────────────────────────────────
router.get("/public/packages/:packageId", async (req, res): Promise<void> => {
  const packageId = Number(req.params.packageId);
  if (!Number.isSafeInteger(packageId) || packageId <= 0) {
    res.status(404).json({ error: "Programa não encontrado" });
    return;
  }

  const [pkg] = await db.select().from(carePackagesTable)
    .where(and(eq(carePackagesTable.id, packageId), eq(carePackagesTable.active, true)))
    .limit(1);
  if (!pkg) {
    res.status(404).json({ error: "Programa não encontrado ou indisponível" });
    return;
  }

  const [clinic] = await db.select({
    name: clinicsTable.name,
    logoUrl: clinicsTable.logoUrl,
    primaryColor: clinicsTable.primaryColor,
  }).from(clinicsTable).where(eq(clinicsTable.id, pkg.clinicId)).limit(1);
  if (!clinic) {
    res.status(404).json({ error: "Programa não encontrado ou indisponível" });
    return;
  }

  const [branding] = await db.select({
    clinicName: clinicSettingsTable.clinicName,
    logoUrl: clinicSettingsTable.logoUrl,
  }).from(clinicSettingsTable)
    .where(eq(clinicSettingsTable.clinicId, pkg.clinicId))
    .limit(1);

  const [publicPage] = await db.select({ slug: clinicPublicPagesTable.slug })
    .from(clinicPublicPagesTable)
    .where(and(
      eq(clinicPublicPagesTable.clinicId, pkg.clinicId),
      eq(clinicPublicPagesTable.published, true),
    ))
    .limit(1);
  const slots = await db.select().from(carePackageSlotsTable)
    .where(eq(carePackageSlotsTable.packageId, pkg.id));
  const doctorIds = [...new Set(slots.flatMap((slot) => slot.doctorId === null ? [] : [slot.doctorId]))];
  const assignedDoctors = doctorIds.length > 0
    ? await db.select({
      id: doctorsTable.id,
      name: usersTable.name,
      specialty: doctorsTable.specialty,
    })
      .from(doctorsTable)
      .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
      .where(and(
        inArray(doctorsTable.id, doctorIds),
        eq(doctorsTable.clinicId, pkg.clinicId),
        isNull(usersTable.deactivatedAt),
      ))
    : [];
  const doctorsById = new Map(assignedDoctors.map((doctor) => [doctor.id, doctor]));

  res.set("Cache-Control", "public, max-age=60");
  res.json({
    name: pkg.name,
    description: pkg.description,
    durationDays: pkg.durationDays,
    priceCents: pkg.priceCents,
    originalPriceCents: pkg.originalPriceCents,
    clinicName: branding?.clinicName ?? clinic.name,
    clinicLogoUrl: branding ? branding.logoUrl : clinic.logoUrl,
    primaryColor: clinic.primaryColor,
    clinicPageSlug: publicPage?.slug ?? null,
    images: pkg.promotionImages.map((url) => ({ url, caption: null })),
    slots: slots.map((slot) => {
      const doctor = slot.doctorId === null ? undefined : doctorsById.get(slot.doctorId);
      return {
        doctorName: doctor?.name ?? null,
        specialty: doctor?.specialty ?? slot.specialty,
        quantity: slot.quantity,
      };
    }),
  });
});

const publicPackageInterestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas solicitações. Aguarde 15 minutos antes de tentar novamente." },
});

const publicPackageInterestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().max(24).refine(
    (value) => /^[+\d\s().-]+$/.test(value) && /^\d{10,15}$/.test(value.replace(/\D/g, "")),
    "Informe um telefone válido com DDD.",
  ),
  consent: z.literal(true),
});

router.post("/public/packages/:packageId/contact-requests", publicPackageInterestLimiter, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const packageId = Number(req.params.packageId);
  const parsed = publicPackageInterestSchema.safeParse(req.body);
  if (!Number.isSafeInteger(packageId) || packageId <= 0 || !parsed.success) {
    res.status(400).json({ error: "Informe seu nome, telefone válido com DDD e autorize o contato da clínica." });
    return;
  }

  const [pkg] = await db.select({
    id: carePackagesTable.id,
    clinicId: carePackagesTable.clinicId,
    name: carePackagesTable.name,
  }).from(carePackagesTable)
    .where(and(eq(carePackagesTable.id, packageId), eq(carePackagesTable.active, true)))
    .limit(1);
  if (!pkg) {
    res.status(404).json({ error: "Programa não encontrado ou indisponível." });
    return;
  }

  const [recipient] = await db.select({ userId: clinicOwnersTable.userId })
    .from(clinicOwnersTable)
    .innerJoin(usersTable, eq(usersTable.id, clinicOwnersTable.userId))
    .where(and(eq(clinicOwnersTable.clinicId, pkg.clinicId), isNull(usersTable.deactivatedAt)))
    .orderBy(clinicOwnersTable.userId)
    .limit(1);
  if (!recipient) {
    req.log.error({ clinicId: pkg.clinicId }, "Public program interest has no active clinic owner");
    res.status(503).json({ error: "A clínica não pode receber solicitações agora. Tente novamente mais tarde." });
    return;
  }

  const input = parsed.data;
  const source = `Interesse em programa: ${pkg.name}`;
  const notes = `Interessado em ${pkg.name}. Recebido pela página pública do programa. Contato autorizado.`;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${pkg.clinicId}:${input.contact.toLowerCase()}:${source}`}))`);
    const [existing] = await tx.select({ id: leadsTable.id }).from(leadsTable).where(and(
      eq(leadsTable.clinicId, pkg.clinicId),
      eq(leadsTable.contact, input.contact),
      eq(leadsTable.name, input.name),
      eq(leadsTable.source, source),
    )).limit(1);
    if (!existing) {
      await tx.insert(leadsTable).values({
        clinicId: pkg.clinicId,
        authorUserId: recipient.userId,
        name: input.name,
        contact: input.contact,
        source,
        notes,
        status: "novo",
      });
    }
  });

  res.status(201).json({
    received: true,
    message: "Cadastro recebido! A equipe da clínica entrará em contato em breve.",
  });
});

router.get("/packages", async (req, res): Promise<void> => {
  const auth = await requirePackageReader(req);
  if (isOwnerError(auth)) { res.status(auth.status).json({ error: auth.error }); return; }
  const { clinicId } = auth;

  const packages = await db.select().from(carePackagesTable).where(eq(carePackagesTable.clinicId, clinicId));

  const results = await Promise.all(
    packages.map(async (pkg) => {
      const packageSlots = await db
        .select({ quantity: carePackageSlotsTable.quantity })
        .from(carePackageSlotsTable)
        .where(eq(carePackageSlotsTable.packageId, pkg.id));
      const [enrollRow] = await db
        .select({ cnt: count() })
        .from(patientPackagesTable)
        .where(and(eq(patientPackagesTable.packageId, pkg.id), eq(patientPackagesTable.clinicId, clinicId)));
      return {
        id: pkg.id,
        clinicId: pkg.clinicId,
        name: pkg.name,
        description: pkg.description ?? null,
        durationDays: pkg.durationDays,
        priceCents: pkg.priceCents,
        originalPriceCents: pkg.originalPriceCents,
        active: pkg.active,
        slotCount: packageSlots.reduce((total, slot) => total + slot.quantity, 0),
        enrollmentCount: enrollRow?.cnt ?? 0,
        createdAt: pkg.createdAt.toISOString(),
      };
    })
  );

  res.json(results);
});

// ── POST /packages ────────────────────────────────────────────────────────────
const CreatePackageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationDays: z.number().int().min(1),
  priceCents: z.number().int().min(0),
  originalPriceCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional().default(true),
  promotionImages: z.array(z.string().refine(isValidStorageObjectPath)).max(5).optional().default([]),
  slots: z.array(z.object({
    doctorId: z.number().int().positive().optional(),
    specialty: z.string().min(1),
    quantity: z.number().int().min(1),
  })).min(1),
}).superRefine((data, ctx) => {
  if (data.originalPriceCents != null && data.originalPriceCents <= data.priceCents) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["originalPriceCents"],
      message: "O preço antigo deve ser maior que o preço promocional.",
    });
  }
});

router.post("/packages", async (req, res): Promise<void> => {
  const auth = await requireOwner(req);
  if (isOwnerError(auth)) { res.status(auth.status).json({ error: auth.error }); return; }
  const { clinicId } = auth;

  const parsed = CreatePackageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues }); return; }
  const data = parsed.data;
  if (data.promotionImages.length > 0) {
    const allowedImages = await getAllowedPromotionImages(data.promotionImages, clinicId);
    if (allowedImages.size !== data.promotionImages.length) {
      res.status(400).json({ error: "Uma ou mais imagens não pertencem a esta clínica ou não estão disponíveis para divulgação." });
      return;
    }
  }
  const slots = await normalizePackageSlots(data.slots, clinicId);
  if (!slots) {
    res.status(400).json({ error: "Selecione profissionais ativos cadastrados nesta clínica." });
    return;
  }

  const [newPkg] = await db.insert(carePackagesTable).values({
    clinicId,
    name: data.name,
    description: data.description ?? null,
    durationDays: data.durationDays,
    priceCents: data.priceCents,
    originalPriceCents: data.originalPriceCents ?? null,
    promotionImages: data.promotionImages,
    active: data.active,
  }).returning();

  if (slots.length > 0) {
    await db.insert(carePackageSlotsTable).values(
      slots.map((slot) => ({ packageId: newPkg.id, ...slot }))
    );
  }

  const full = await getPackageWithSlots(newPkg.id);
  res.status(201).json(buildPackageDetailResponse(full!));
});

// ── GET /packages/:packageId ──────────────────────────────────────────────────
router.get("/packages/:packageId", async (req, res): Promise<void> => {
  const auth = await requirePackageReader(req);
  if (isOwnerError(auth)) { res.status(auth.status).json({ error: auth.error }); return; }
  const { clinicId } = auth;
  const packageId = parseInt(req.params.packageId, 10);

  const full = await getPackageWithSlots(packageId);
  if (!full || full.clinicId !== clinicId) { res.status(404).json({ error: "Programa não encontrado" }); return; }

  res.json(buildPackageDetailResponse(full));
});

// ── PATCH /packages/:packageId ────────────────────────────────────────────────
const UpdatePackageSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  durationDays: z.number().int().min(1).optional(),
  priceCents: z.number().int().min(0).optional(),
  originalPriceCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  promotionImages: z.array(z.string().refine(isValidStorageObjectPath)).max(5).optional(),
  slots: z.array(z.object({
    doctorId: z.number().int().positive().optional(),
    specialty: z.string().min(1),
    quantity: z.number().int().min(1),
  })).optional(),
});

router.patch("/packages/:packageId", async (req, res): Promise<void> => {
  const auth = await requireOwner(req);
  if (isOwnerError(auth)) { res.status(auth.status).json({ error: auth.error }); return; }
  const { clinicId } = auth;
  const packageId = parseInt(req.params.packageId, 10);

  const [existing] = await db.select().from(carePackagesTable).where(and(eq(carePackagesTable.id, packageId), eq(carePackagesTable.clinicId, clinicId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Programa não encontrado" }); return; }

  const parsed = UpdatePackageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues }); return; }
  const data = parsed.data;
  const updatedPriceCents = data.priceCents ?? existing.priceCents;
  const updatedOriginalPriceCents = data.originalPriceCents === undefined
    ? existing.originalPriceCents
    : data.originalPriceCents;
  if (updatedOriginalPriceCents != null && updatedOriginalPriceCents <= updatedPriceCents) {
    res.status(400).json({
      error: "O preço antigo deve ser maior que o preço promocional.",
      details: [{ path: ["originalPriceCents"], message: "O preço antigo deve ser maior que o preço promocional." }],
    });
    return;
  }
  if (data.promotionImages !== undefined) {
    const allowedImages = await getAllowedPromotionImages(data.promotionImages, clinicId, existing.promotionImages);
    if (allowedImages.size !== data.promotionImages.length) {
      res.status(400).json({ error: "Uma ou mais imagens não pertencem a esta clínica ou não estão disponíveis para divulgação." });
      return;
    }
  }
  const slots = data.slots === undefined ? undefined : await normalizePackageSlots(data.slots, clinicId);
  if (slots === null) {
    res.status(400).json({ error: "Selecione profissionais ativos cadastrados nesta clínica." });
    return;
  }

  const updateFields: Partial<typeof carePackagesTable.$inferInsert> = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.description !== undefined) updateFields.description = data.description;
  if (data.durationDays !== undefined) updateFields.durationDays = data.durationDays;
  if (data.priceCents !== undefined) updateFields.priceCents = data.priceCents;
  if (data.originalPriceCents !== undefined) updateFields.originalPriceCents = data.originalPriceCents;
  if (data.active !== undefined) updateFields.active = data.active;
  if (data.promotionImages !== undefined) updateFields.promotionImages = data.promotionImages;
  updateFields.updatedAt = new Date();

  await db.update(carePackagesTable).set(updateFields).where(eq(carePackagesTable.id, packageId));

  if (slots !== undefined) {
    await db.delete(carePackageSlotsTable).where(eq(carePackageSlotsTable.packageId, packageId));
    if (slots.length > 0) {
      await db.insert(carePackageSlotsTable).values(
        slots.map((slot) => ({ packageId, ...slot }))
      );
    }
  }

  const full = await getPackageWithSlots(packageId);
  res.json(buildPackageDetailResponse(full!));
});

// ── DELETE /packages/:packageId ───────────────────────────────────────────────
router.delete("/packages/:packageId", async (req, res): Promise<void> => {
  const auth = await requireOwner(req);
  if (isOwnerError(auth)) { res.status(auth.status).json({ error: auth.error }); return; }
  const { clinicId } = auth;
  const packageId = parseInt(req.params.packageId, 10);

  const [existing] = await db.select().from(carePackagesTable).where(and(eq(carePackagesTable.id, packageId), eq(carePackagesTable.clinicId, clinicId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Programa não encontrado" }); return; }

  const [enrollRow] = await db.select({ cnt: count() }).from(patientPackagesTable).where(eq(patientPackagesTable.packageId, packageId));
  if ((enrollRow?.cnt ?? 0) > 0) {
    res.status(409).json({ error: "Não é possível excluir um programa com matrículas" });
    return;
  }

  await db.delete(carePackagesTable).where(eq(carePackagesTable.id, packageId));
  res.status(204).end();
});

// ── GET /patients/:patientId/packages ─────────────────────────────────────────
router.get("/patients/:patientId/packages", async (req, res): Promise<void> => {
  const auth = await requireOwner(req);
  if (isOwnerError(auth)) { res.status(auth.status).json({ error: auth.error }); return; }
  const { clinicId } = auth;
  const patientId = parseInt(req.params.patientId, 10);

  const enrollment = await db
    .select()
    .from(patientClinicsTable)
    .where(and(eq(patientClinicsTable.patientId, patientId), eq(patientClinicsTable.clinicId, clinicId)))
    .limit(1);
  if (enrollment.length === 0) { res.status(404).json({ error: "Paciente não encontrado nesta clínica" }); return; }

  const enrollments = await db
    .select()
    .from(patientPackagesTable)
    .where(and(eq(patientPackagesTable.patientId, patientId), eq(patientPackagesTable.clinicId, clinicId)));

  const results = await Promise.all(enrollments.map(buildEnrollmentResponse));
  res.json(results);
});

// ── POST /patients/:patientId/packages ────────────────────────────────────────
const EnrollSchema = z.object({
  packageId: z.number().int(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assignments: z.array(z.object({
    slotId: z.number().int(),
    doctorId: z.number().int(),
  })),
});

router.post("/patients/:patientId/packages", async (req, res): Promise<void> => {
  const auth = await requireOwner(req);
  if (isOwnerError(auth)) { res.status(auth.status).json({ error: auth.error }); return; }
  const { clinicId } = auth;
  const patientId = parseInt(req.params.patientId, 10);

  const enrollment = await db
    .select()
    .from(patientClinicsTable)
    .where(and(eq(patientClinicsTable.patientId, patientId), eq(patientClinicsTable.clinicId, clinicId)))
    .limit(1);
  if (enrollment.length === 0) { res.status(404).json({ error: "Paciente não encontrado nesta clínica" }); return; }

  const parsed = EnrollSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues }); return; }
  const data = parsed.data;

  const pkg = await getPackageWithSlots(data.packageId);
  if (!pkg || pkg.clinicId !== clinicId) { res.status(404).json({ error: "Programa não encontrado" }); return; }
  if (!pkg.active) { res.status(400).json({ error: "Este programa está inativo" }); return; }

  const activeEnrollment = await db
    .select({ id: patientPackagesTable.id })
    .from(patientPackagesTable)
    .where(and(
      eq(patientPackagesTable.patientId, patientId),
      eq(patientPackagesTable.packageId, data.packageId),
      eq(patientPackagesTable.clinicId, clinicId),
      eq(patientPackagesTable.status, "active"),
    ))
    .limit(1);
  if (activeEnrollment.length > 0) {
    throw new ApiError(409, "ACTIVE_ENROLLMENT_ALREADY_EXISTS", "O paciente já possui uma matrícula ativa neste programa.");
  }

  // Validate each assignment's doctor belongs to this clinic
  for (const assignment of data.assignments) {
    const [doctor] = await db
      .select()
      .from(doctorsTable)
      .where(and(eq(doctorsTable.id, assignment.doctorId), eq(doctorsTable.clinicId, clinicId)))
      .limit(1);
    if (!doctor) {
      res.status(400).json({ error: `Profissional ${assignment.doctorId} não pertence a esta clínica` });
      return;
    }
    // Validate slotId belongs to this package
    const slot = pkg.slots.find((s) => s.id === assignment.slotId);
    if (!slot) {
      res.status(400).json({ error: `Vaga ${assignment.slotId} não pertence a este programa` });
      return;
    }
  }

  // Calculate end date
  const startDate = new Date(data.startDate + "T12:00:00");
  const endDate = new Date(startDate.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);
  const endDateStr = endDate.toISOString().split("T")[0];

  try {
    const result = await db.transaction(async (tx) => {
      const [newEnrollment] = await tx.insert(patientPackagesTable).values({
        patientId,
        packageId: data.packageId,
        clinicId,
        startDate: data.startDate,
        endDate: endDateStr,
        status: "active",
      }).returning();

      if (data.assignments.length > 0) {
        await tx.insert(patientPackageDoctorsTable).values(
          data.assignments.map((a) => ({
            patientPackageId: newEnrollment.id,
            slotId: a.slotId,
            doctorId: a.doctorId,
          }))
        );

        for (const assignment of data.assignments) {
          const existing = await tx
            .select()
            .from(patientDoctorsTable)
            .where(and(eq(patientDoctorsTable.patientId, patientId), eq(patientDoctorsTable.doctorId, assignment.doctorId)))
            .limit(1);
          if (existing.length === 0) {
            await tx.insert(patientDoctorsTable).values({ patientId, doctorId: assignment.doctorId });
          }
        }
      }

      return newEnrollment;
    });

    const response = await buildEnrollmentResponse(result);
    res.status(201).json(response);
  } catch (err) {
    if (isUniqueEnrollmentViolation(err)) {
      throw new ApiError(409, "ACTIVE_ENROLLMENT_ALREADY_EXISTS", "O paciente já possui uma matrícula ativa neste programa.");
    }
    throw err;
  }
});

// ── PATCH /patients/:patientId/packages/:enrollmentId ─────────────────────────
const UpdateEnrollmentSchema = z.object({
  status: z.enum(["completed", "cancelled"]),
});

router.patch("/patients/:patientId/packages/:enrollmentId", async (req, res): Promise<void> => {
  const auth = await requireOwner(req);
  if (isOwnerError(auth)) { res.status(auth.status).json({ error: auth.error }); return; }
  const { clinicId } = auth;
  const patientId = parseInt(req.params.patientId, 10);
  const enrollmentId = parseInt(req.params.enrollmentId, 10);

  const [existing] = await db
    .select()
    .from(patientPackagesTable)
    .where(and(
      eq(patientPackagesTable.id, enrollmentId),
      eq(patientPackagesTable.patientId, patientId),
      eq(patientPackagesTable.clinicId, clinicId)
    ))
    .limit(1);
  if (!existing) { res.status(404).json({ error: "Matrícula não encontrada" }); return; }

  const parsed = UpdateEnrollmentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues }); return; }

  // Remove patient_doctors links that were created by this enrollment
  const doctorAssignments = await db
    .select({ doctorId: patientPackageDoctorsTable.doctorId })
    .from(patientPackageDoctorsTable)
    .where(eq(patientPackageDoctorsTable.patientPackageId, enrollmentId));

  for (const { doctorId } of doctorAssignments) {
    // Only remove the link if the doctor is not linked via another active enrollment
    const otherActiveEnrollments = await db
      .select({ id: patientPackageDoctorsTable.id })
      .from(patientPackageDoctorsTable)
      .innerJoin(patientPackagesTable, eq(patientPackagesTable.id, patientPackageDoctorsTable.patientPackageId))
      .where(and(
        eq(patientPackageDoctorsTable.doctorId, doctorId),
        eq(patientPackagesTable.patientId, patientId),
        eq(patientPackagesTable.status, "active"),
        sql`${patientPackageDoctorsTable.patientPackageId} != ${enrollmentId}`
      ));

    if (otherActiveEnrollments.length === 0) {
      await db
        .delete(patientDoctorsTable)
        .where(and(eq(patientDoctorsTable.patientId, patientId), eq(patientDoctorsTable.doctorId, doctorId)));
    }
  }

  const [updated] = await db
    .update(patientPackagesTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(patientPackagesTable.id, enrollmentId))
    .returning();

  const result = await buildEnrollmentResponse(updated);
  res.json(result);
});

export default router;
