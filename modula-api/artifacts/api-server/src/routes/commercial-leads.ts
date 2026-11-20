import { Router } from "express";
import rateLimit from "express-rate-limit";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, commercialLeadsTable, clinicsTable } from "@workspace/db";
import { requireAuth, isError } from "../lib/auth-helpers";

const router = Router();

const publicInquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas solicitações. Aguarde 15 minutos antes de tentar novamente." },
  handler: (req, res, _next, options) => {
    req.log.warn({ ip: req.ip }, "Public Enterprise inquiry rate limit exceeded");
    res.status(options.statusCode).json(options.message);
  },
});

const phoneSchema = z.string().trim().max(24).refine(
  (value) => /^[+\d\s().-]+$/.test(value) && /^\d{10,15}$/.test(value.replace(/\D/g, "")),
  "Informe um telefone válido com DDD.",
);

const publicInquiryBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  message: z.string().trim().max(1500).optional(),
  consent: z.literal(true),
});

const commercialLeadStatus = z.enum(["novo", "contatado", "convertido", "perdido"]);

router.post("/public/enterprise-inquiries", publicInquiryLimiter, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const parsed = publicInquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe nome, e-mail, telefone com DDD e autorize o contato comercial." });
    return;
  }

  const [lead] = await db.insert(commercialLeadsTable).values({
    type: "new_prospect",
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message || null,
    status: "novo",
  }).returning({ id: commercialLeadsTable.id });

  req.log.info({ leadId: lead!.id }, "Public Enterprise prospect added to commercial leads");
  res.status(201).json({ received: true, message: "Solicitação recebida. Nossa equipe entrará em contato em breve." });
});

router.get("/admin/commercial-leads", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Acesso restrito a super administradores." });
    return;
  }

  const leads = await db.select({
    id: commercialLeadsTable.id,
    type: commercialLeadsTable.type,
    clinicId: commercialLeadsTable.clinicId,
    clinicName: clinicsTable.name,
    name: commercialLeadsTable.name,
    email: commercialLeadsTable.email,
    phone: commercialLeadsTable.phone,
    message: commercialLeadsTable.message,
    status: commercialLeadsTable.status,
    createdAt: commercialLeadsTable.createdAt,
    updatedAt: commercialLeadsTable.updatedAt,
  }).from(commercialLeadsTable)
    .leftJoin(clinicsTable, eq(clinicsTable.id, commercialLeadsTable.clinicId))
    .orderBy(desc(commercialLeadsTable.createdAt));

  res.json(leads);
});

router.patch("/admin/commercial-leads/:leadId/status", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }
  if (authResult.user.role !== "super_admin") {
    res.status(403).json({ error: "Acesso restrito a super administradores." });
    return;
  }

  const leadId = Number(req.params.leadId);
  const parsed = z.object({ status: commercialLeadStatus }).safeParse(req.body);
  if (!Number.isSafeInteger(leadId) || leadId <= 0 || !parsed.success) {
    res.status(400).json({ error: "Solicitação ou status inválido." });
    return;
  }

  const [lead] = await db.update(commercialLeadsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(commercialLeadsTable.id, leadId))
    .returning({
      id: commercialLeadsTable.id,
      status: commercialLeadsTable.status,
      updatedAt: commercialLeadsTable.updatedAt,
    });

  if (!lead) {
    res.status(404).json({ error: "Solicitação comercial não encontrada." });
    return;
  }
  res.json(lead);
});

export default router;
