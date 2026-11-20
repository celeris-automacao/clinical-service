import { Router } from "express";
import { eq, ne, and, asc, isNull, sql } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  db,
  clinicPublicPagesTable,
  clinicPublicServicesTable,
  clinicGalleryPhotosTable,
  clinicsTable,
  clinicSettingsTable,
  doctorsTable,
  usersTable,
  patientClinicsTable,
  patientsTable,
  clinicOwnersTable,
  leadsTable,
} from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId, resolveCallerClinicId } from "../lib/auth-helpers";
import {
  UpdateClinicPublicPageBody,
  CreateClinicPublicServiceBody,
  UpdateClinicPublicServiceBody,
  ReorderClinicPublicServicesBody,
  AddClinicGalleryPhotoBody,
  UpdateClinicGalleryPhotoBody,
  ReorderClinicGalleryPhotosBody,
  UpdateClinicPublicTeamMemberBody,
  CreatePublicClinicContactRequestBody,
} from "@workspace/api-zod";

const router = Router();

const publicRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas solicitações. Aguarde 15 minutos antes de tentar novamente." },
  handler: (req, res, _next, options) => {
    req.log.warn({ ip: req.ip }, "Public clinic contact request rate limit exceeded");
    res.status(options.statusCode).json(options.message);
  },
});

const requestBody = CreatePublicClinicContactRequestBody.extend({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().max(24).refine(
    (value) => /^[+\d\s().-]+$/.test(value) && /^\d{10,15}$/.test(value.replace(/\D/g, "")),
    "Informe um telefone válido com DDD.",
  ),
  message: z.string().trim().min(1).max(2000),
  consent: z.literal(true),
});

router.get("/public/clinics/:slug/appointment-slots", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  res.status(410).json({ error: "Solicitações de consulta não estão mais disponíveis. Envie um recado para a clínica." });
});

router.post("/public/clinics/:slug/appointment-requests", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  res.status(410).json({ error: "Solicitações de consulta não estão mais disponíveis. Envie um recado para a clínica." });
});

router.post("/public/clinics/:slug/contact-requests", publicRequestLimiter, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = requestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Preencha nome, telefone válido com DDD, recado e autorize o contato da clínica." });
    return;
  }
  const input = parsed.data;
  const [page] = await db.select({ clinicId: clinicPublicPagesTable.clinicId }).from(clinicPublicPagesTable)
    .where(and(eq(clinicPublicPagesTable.slug, String(req.params.slug)), eq(clinicPublicPagesTable.published, true)))
    .limit(1);
  if (!page) {
    res.status(404).json({ error: "Página da clínica indisponível." });
    return;
  }
  // The existing lead inbox requires a responsible owner, not a visitor account.
  const [recipient] = await db.select({ userId: clinicOwnersTable.userId }).from(clinicOwnersTable)
    .innerJoin(usersTable, eq(usersTable.id, clinicOwnersTable.userId))
    .where(and(eq(clinicOwnersTable.clinicId, page.clinicId), isNull(usersTable.deactivatedAt)))
    .orderBy(asc(clinicOwnersTable.userId)).limit(1);
  if (!recipient) {
    req.log.error({ clinicId: page.clinicId }, "Public clinic contact request has no active clinic owner");
    res.status(503).json({ error: "A clínica não pode receber solicitações agora. Tente novamente mais tarde." });
    return;
  }
  const notes = `Recado: ${input.message}\nContato autorizado pelo visitante. Recebido pela página pública.`;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${page.clinicId}:${input.contact.toLowerCase()}:${notes}`}))`);
    const [existing] = await tx.select({ id: leadsTable.id }).from(leadsTable).where(and(
      eq(leadsTable.clinicId, page.clinicId), eq(leadsTable.contact, input.contact),
      eq(leadsTable.name, input.name), eq(leadsTable.notes, notes),
      eq(leadsTable.source, "Recado pela página pública"),
    )).limit(1);
    if (!existing) await tx.insert(leadsTable).values({
      clinicId: page.clinicId, authorUserId: recipient.userId,
      name: input.name, contact: input.contact, source: "Recado pela página pública", notes, status: "novo",
    });
  });
  res.status(201).json({
    received: true,
    message: "Recado enviado! A equipe entrará em contato em breve.",
  });
});

function serializePage(page: typeof clinicPublicPagesTable.$inferSelect) {
  return {
    slug: page.slug,
    published: page.published,
    tagline: page.tagline ?? null,
    about: page.about ?? null,
    coverImageUrl: page.coverImageUrl ?? null,
    address: page.address ?? null,
    phone: page.phone ?? null,
    contactEmail: page.contactEmail ?? null,
    socialLinks: page.socialLinks ?? null,
    businessHours: page.businessHours ?? null,
    updatedAt: page.updatedAt.toISOString(),
  };
}

function serializeService(service: typeof clinicPublicServicesTable.$inferSelect) {
  return {
    id: service.id,
    title: service.title,
    description: service.description ?? null,
    order: service.order,
  };
}

function serializeGalleryPhoto(photo: typeof clinicGalleryPhotosTable.$inferSelect) {
  return {
    id: photo.id,
    url: photo.url,
    caption: photo.caption ?? null,
    order: photo.order,
  };
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function getOrCreatePublicPage(clinicId: number) {
  const [existing] = await db
    .select()
    .from(clinicPublicPagesTable)
    .where(eq(clinicPublicPagesTable.clinicId, clinicId))
    .limit(1);
  if (existing) return existing;

  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, clinicId)).limit(1);
  const baseSlug = (clinic?.name && slugify(clinic.name)) || `clinica-${clinicId}`;
  let candidateSlug = baseSlug;
  let attempt = 0;
  while (true) {
    const [conflict] = await db
      .select({ id: clinicPublicPagesTable.id })
      .from(clinicPublicPagesTable)
      .where(eq(clinicPublicPagesTable.slug, candidateSlug))
      .limit(1);
    if (!conflict) break;
    attempt += 1;
    candidateSlug = `${baseSlug}-${clinicId}${attempt > 1 ? `-${attempt}` : ""}`;
  }

  const [created] = await db
    .insert(clinicPublicPagesTable)
    .values({ clinicId, slug: candidateSlug, published: false })
    .returning();
  return created!;
}

// ─── GET /public/clinics/:slug (public, no auth) ──────────────────────────────
router.get("/public/clinics/:slug", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [page] = await db
    .select()
    .from(clinicPublicPagesTable)
    .where(and(eq(clinicPublicPagesTable.slug, raw), eq(clinicPublicPagesTable.published, true)))
    .limit(1);
  if (!page) {
    res.status(404).json({ error: "Página não encontrada" });
    return;
  }

  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, page.clinicId)).limit(1);
  if (!clinic) {
    res.status(404).json({ error: "Página não encontrada" });
    return;
  }

  const [settings] = await db
    .select()
    .from(clinicSettingsTable)
    .where(eq(clinicSettingsTable.clinicId, page.clinicId))
    .limit(1);

  const services = await db
    .select()
    .from(clinicPublicServicesTable)
    .where(eq(clinicPublicServicesTable.clinicId, page.clinicId))
    .orderBy(asc(clinicPublicServicesTable.order));

  const teamRows = await db
    .select({ doctor: doctorsTable, user: usersTable })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(and(eq(doctorsTable.clinicId, page.clinicId), eq(doctorsTable.showOnPublicPage, true), isNull(usersTable.deactivatedAt)));

  const galleryPhotos = await db
    .select()
    .from(clinicGalleryPhotosTable)
    .where(eq(clinicGalleryPhotosTable.clinicId, page.clinicId))
    .orderBy(asc(clinicGalleryPhotosTable.order));

  res.json({
    clinicName: settings?.clinicName ?? clinic.name,
    logoUrl: settings ? settings.logoUrl : clinic.logoUrl ?? null,
    primaryColor: clinic.primaryColor ?? null,
    slug: page.slug,
    tagline: page.tagline ?? null,
    about: page.about ?? null,
    coverImageUrl: page.coverImageUrl ?? null,
    address: page.address ?? null,
    phone: page.phone ?? null,
    contactEmail: page.contactEmail ?? null,
    socialLinks: page.socialLinks ?? null,
    businessHours: page.businessHours ?? null,
    services: services.map(serializeService),
    team: teamRows.map(({ doctor, user }) => ({
      id: doctor.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      specialty: doctor.specialty,
      bio: doctor.bio ?? null,
      showOnPublicPage: doctor.showOnPublicPage,
    })),
    gallery: galleryPhotos.map(serializeGalleryPhoto),
  });
});

function isOwnerClinicError(
  result: { clinicId: number } | { error: string; status: number }
): result is { error: string; status: number } {
  return "error" in result;
}

// ─── GET /clinic/public-page/link (any authenticated role) ───────────────────
router.get("/clinic/public-page/link", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  let clinicId: number | null = null;
  if (authResult.user.role === "patient") {
    const [patient] = await db
      .select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.userId, authResult.user.id))
      .limit(1);
    if (patient) {
      const [membership] = await db
        .select({ clinicId: patientClinicsTable.clinicId })
        .from(patientClinicsTable)
        .where(eq(patientClinicsTable.patientId, patient.id))
        .limit(1);
      clinicId = membership?.clinicId ?? null;
    }
  } else {
    clinicId = await resolveCallerClinicId(authResult.user, authResult.clinicId);
  }

  if (clinicId == null) {
    res.json({ slug: null, published: false });
    return;
  }

  const [page] = await db
    .select({ slug: clinicPublicPagesTable.slug, published: clinicPublicPagesTable.published })
    .from(clinicPublicPagesTable)
    .where(eq(clinicPublicPagesTable.clinicId, clinicId))
    .limit(1);

  res.json({ slug: page?.slug ?? null, published: page?.published ?? false });
});

async function requireOwnerClinicId(
  req: Parameters<typeof requireAuth>[0]
): Promise<{ clinicId: number } | { error: string; status: number }> {
  const authResult = await requireAuth(req);
  if (isError(authResult)) return authResult;
  if (authResult.user.role !== "clinic_owner") {
    return { status: 403, error: "Acesso restrito ao proprietário" };
  }
  const clinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (clinicId == null) {
    return { status: 403, error: "Administrador não vinculado a nenhuma clínica." };
  }
  return { clinicId };
}

// ─── GET /clinic/public-page ───────────────────────────────────────────────────
router.get("/clinic/public-page", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  const page = await getOrCreatePublicPage(result.clinicId);
  res.json(serializePage(page));
});

// ─── PATCH /clinic/public-page ──────────────────────────────────────────────────
router.patch("/clinic/public-page", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const parsed = UpdateClinicPublicPageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const page = await getOrCreatePublicPage(result.clinicId);

  if (parsed.data.slug !== undefined && parsed.data.slug !== page.slug) {
    const [conflict] = await db
      .select({ id: clinicPublicPagesTable.id })
      .from(clinicPublicPagesTable)
      .where(and(eq(clinicPublicPagesTable.slug, parsed.data.slug), ne(clinicPublicPagesTable.id, page.id)))
      .limit(1);
    if (conflict) {
      res.status(400).json({ error: "Este endereço (slug) já está em uso por outra clínica." });
      return;
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.slug !== undefined) updateData.slug = parsed.data.slug;
  if (parsed.data.published !== undefined) updateData.published = parsed.data.published;
  if (parsed.data.tagline !== undefined) updateData.tagline = parsed.data.tagline;
  if (parsed.data.about !== undefined) updateData.about = parsed.data.about;
  if (parsed.data.coverImageUrl !== undefined) updateData.coverImageUrl = parsed.data.coverImageUrl;
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.contactEmail !== undefined) updateData.contactEmail = parsed.data.contactEmail;
  if (parsed.data.socialLinks !== undefined) updateData.socialLinks = parsed.data.socialLinks;
  if (parsed.data.businessHours !== undefined) updateData.businessHours = parsed.data.businessHours;

  const [updated] = await db
    .update(clinicPublicPagesTable)
    .set(updateData)
    .where(eq(clinicPublicPagesTable.id, page.id))
    .returning();

  res.json(serializePage(updated!));
});

// ─── GET /clinic/public-page/services ──────────────────────────────────────────
router.get("/clinic/public-page/services", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  const services = await db
    .select()
    .from(clinicPublicServicesTable)
    .where(eq(clinicPublicServicesTable.clinicId, result.clinicId))
    .orderBy(asc(clinicPublicServicesTable.order));
  res.json(services.map(serializeService));
});

// ─── POST /clinic/public-page/services ─────────────────────────────────────────
router.post("/clinic/public-page/services", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const parsed = CreateClinicPublicServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const [maxRow] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${clinicPublicServicesTable.order}), -1)` })
    .from(clinicPublicServicesTable)
    .where(eq(clinicPublicServicesTable.clinicId, result.clinicId));
  const nextOrder = Number(maxRow?.maxOrder ?? -1) + 1;

  const [created] = await db
    .insert(clinicPublicServicesTable)
    .values({
      clinicId: result.clinicId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      order: nextOrder,
    })
    .returning();

  res.status(201).json(serializeService(created!));
});

// ─── PATCH /clinic/public-page/services/reorder ───────────────────────────────
router.patch("/clinic/public-page/services/reorder", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const parsed = ReorderClinicPublicServicesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const existing = await db
    .select({ id: clinicPublicServicesTable.id })
    .from(clinicPublicServicesTable)
    .where(eq(clinicPublicServicesTable.clinicId, result.clinicId));
  const existingIds = new Set(existing.map((r) => r.id));
  const invalid = parsed.data.serviceIds.some((id) => !existingIds.has(id));
  if (invalid || parsed.data.serviceIds.length !== existingIds.size) {
    res.status(400).json({ error: "Lista de serviços inválida — deve incluir todos os serviços da clínica." });
    return;
  }

  await Promise.all(
    parsed.data.serviceIds.map((id, index) =>
      db
        .update(clinicPublicServicesTable)
        .set({ order: index, updatedAt: new Date() })
        .where(and(eq(clinicPublicServicesTable.id, id), eq(clinicPublicServicesTable.clinicId, result.clinicId)))
    )
  );

  const services = await db
    .select()
    .from(clinicPublicServicesTable)
    .where(eq(clinicPublicServicesTable.clinicId, result.clinicId))
    .orderBy(asc(clinicPublicServicesTable.order));
  res.json(services.map(serializeService));
});

// ─── PATCH /clinic/public-page/services/:serviceId ─────────────────────────────
router.patch("/clinic/public-page/services/:serviceId", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const parsed = UpdateClinicPublicServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const raw = Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId;
  const serviceId = parseInt(raw, 10);

  const [service] = await db
    .select()
    .from(clinicPublicServicesTable)
    .where(eq(clinicPublicServicesTable.id, serviceId))
    .limit(1);
  if (!service || service.clinicId !== result.clinicId) {
    res.status(404).json({ error: "Serviço não encontrado" });
    return;
  }

  const [updated] = await db
    .update(clinicPublicServicesTable)
    .set({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      updatedAt: new Date(),
    })
    .where(eq(clinicPublicServicesTable.id, serviceId))
    .returning();

  res.json(serializeService(updated!));
});

// ─── DELETE /clinic/public-page/services/:serviceId ────────────────────────────
router.delete("/clinic/public-page/services/:serviceId", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const raw = Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId;
  const serviceId = parseInt(raw, 10);

  const [service] = await db
    .select()
    .from(clinicPublicServicesTable)
    .where(eq(clinicPublicServicesTable.id, serviceId))
    .limit(1);
  if (!service || service.clinicId !== result.clinicId) {
    res.status(404).json({ error: "Serviço não encontrado" });
    return;
  }

  await db.delete(clinicPublicServicesTable).where(eq(clinicPublicServicesTable.id, serviceId));
  res.status(204).send();
});

// ─── GET /clinic/public-page/gallery ───────────────────────────────────────────
router.get("/clinic/public-page/gallery", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  const photos = await db
    .select()
    .from(clinicGalleryPhotosTable)
    .where(eq(clinicGalleryPhotosTable.clinicId, result.clinicId))
    .orderBy(asc(clinicGalleryPhotosTable.order));
  res.json(photos.map(serializeGalleryPhoto));
});

// ─── POST /clinic/public-page/gallery ──────────────────────────────────────────
router.post("/clinic/public-page/gallery", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const parsed = AddClinicGalleryPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const [maxRow] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${clinicGalleryPhotosTable.order}), -1)` })
    .from(clinicGalleryPhotosTable)
    .where(eq(clinicGalleryPhotosTable.clinicId, result.clinicId));
  const nextOrder = Number(maxRow?.maxOrder ?? -1) + 1;

  const [created] = await db
    .insert(clinicGalleryPhotosTable)
    .values({
      clinicId: result.clinicId,
      url: parsed.data.url,
      caption: parsed.data.caption ?? null,
      order: nextOrder,
    })
    .returning();

  res.status(201).json(serializeGalleryPhoto(created!));
});

// ─── PATCH /clinic/public-page/gallery/reorder ─────────────────────────────────
router.patch("/clinic/public-page/gallery/reorder", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const parsed = ReorderClinicGalleryPhotosBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const existing = await db
    .select({ id: clinicGalleryPhotosTable.id })
    .from(clinicGalleryPhotosTable)
    .where(eq(clinicGalleryPhotosTable.clinicId, result.clinicId));
  const existingIds = new Set(existing.map((r) => r.id));
  const invalid = parsed.data.photoIds.some((id) => !existingIds.has(id));
  if (invalid || parsed.data.photoIds.length !== existingIds.size) {
    res.status(400).json({ error: "Lista de fotos inválida — deve incluir todas as fotos da galeria." });
    return;
  }

  await Promise.all(
    parsed.data.photoIds.map((id, index) =>
      db
        .update(clinicGalleryPhotosTable)
        .set({ order: index })
        .where(and(eq(clinicGalleryPhotosTable.id, id), eq(clinicGalleryPhotosTable.clinicId, result.clinicId)))
    )
  );

  const photos = await db
    .select()
    .from(clinicGalleryPhotosTable)
    .where(eq(clinicGalleryPhotosTable.clinicId, result.clinicId))
    .orderBy(asc(clinicGalleryPhotosTable.order));
  res.json(photos.map(serializeGalleryPhoto));
});

// ─── PATCH /clinic/public-page/gallery/:photoId ────────────────────────────────
router.patch("/clinic/public-page/gallery/:photoId", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const raw = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
  const photoId = parseInt(raw, 10);

  const parsed = UpdateClinicGalleryPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const [photo] = await db
    .select()
    .from(clinicGalleryPhotosTable)
    .where(eq(clinicGalleryPhotosTable.id, photoId))
    .limit(1);
  if (!photo || photo.clinicId !== result.clinicId) {
    res.status(404).json({ error: "Foto não encontrada" });
    return;
  }

  const [updated] = await db
    .update(clinicGalleryPhotosTable)
    .set({ caption: parsed.data.caption ?? null })
    .where(eq(clinicGalleryPhotosTable.id, photoId))
    .returning();

  res.json(serializeGalleryPhoto(updated!));
});

// ─── DELETE /clinic/public-page/gallery/:photoId ───────────────────────────────
router.delete("/clinic/public-page/gallery/:photoId", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const raw = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
  const photoId = parseInt(raw, 10);

  const [photo] = await db
    .select()
    .from(clinicGalleryPhotosTable)
    .where(eq(clinicGalleryPhotosTable.id, photoId))
    .limit(1);
  if (!photo || photo.clinicId !== result.clinicId) {
    res.status(404).json({ error: "Foto não encontrada" });
    return;
  }

  await db.delete(clinicGalleryPhotosTable).where(eq(clinicGalleryPhotosTable.id, photoId));
  res.status(204).send();
});

// ─── PATCH /clinic/public-page/team/:doctorId ──────────────────────────────────
router.patch("/clinic/public-page/team/:doctorId", async (req, res): Promise<void> => {
  const result = await requireOwnerClinicId(req);
  if (isOwnerClinicError(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const parsed = UpdateClinicPublicTeamMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const raw = Array.isArray(req.params.doctorId) ? req.params.doctorId[0] : req.params.doctorId;
  const doctorId = parseInt(raw, 10);

  const [doctor] = await db
    .select({ doctor: doctorsTable, user: usersTable })
    .from(doctorsTable)
    .innerJoin(usersTable, eq(usersTable.id, doctorsTable.userId))
    .where(eq(doctorsTable.id, doctorId))
    .limit(1);

  if (!doctor || doctor.doctor.clinicId !== result.clinicId) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }

  const doctorUpdate: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.bio !== undefined) doctorUpdate.bio = parsed.data.bio;
  if (parsed.data.showOnPublicPage !== undefined) doctorUpdate.showOnPublicPage = parsed.data.showOnPublicPage;

  const [updatedDoctor] = await db
    .update(doctorsTable)
    .set(doctorUpdate)
    .where(eq(doctorsTable.id, doctorId))
    .returning();

  let updatedUser = doctor.user;
  if (parsed.data.avatarUrl !== undefined) {
    const [u] = await db
      .update(usersTable)
      .set({ avatarUrl: parsed.data.avatarUrl })
      .where(eq(usersTable.id, doctor.user.id))
      .returning();
    if (u) updatedUser = u;
  }

  res.json({
    id: updatedDoctor!.id,
    name: updatedUser.name,
    avatarUrl: updatedUser.avatarUrl ?? null,
    specialty: updatedDoctor!.specialty,
    bio: updatedDoctor!.bio ?? null,
    showOnPublicPage: updatedDoctor!.showOnPublicPage,
  });
});

export default router;
