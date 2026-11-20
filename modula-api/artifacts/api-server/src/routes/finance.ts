import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, gte, lte, desc, ne } from "drizzle-orm";
import {
  db,
  appointmentsTable,
  doctorsTable,
  usersTable,
  patientsTable,
  expensesTable,
} from "@workspace/db";
import { requireAuth, isError, resolveOwnerClinicId } from "../lib/auth-helpers";
import { CreateExpenseBody, UpdateExpenseBody } from "@workspace/api-zod";

const router: IRouter = Router();

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

function periodDateRange(period: string): { start: string; end: string } {
  const [year, month] = period.split("-").map(Number);
  const start = `${period}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${period}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

async function requireOwnerClinic(
  req: Request
): Promise<{ userId: number; clinicId: number } | { status: number; error: string }> {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    return { status: authResult.status, error: authResult.error };
  }
  if (authResult.user.role !== "clinic_owner") {
    return { status: 403, error: "Acesso restrito ao proprietário da clínica." };
  }
  const clinicId = await resolveOwnerClinicId(authResult.user.id, authResult.clinicId);
  if (clinicId == null) {
    return { status: 403, error: "Administrador não vinculado a nenhuma clínica." };
  }
  return { userId: authResult.user.id, clinicId };
}

function isAuthError(
  result: { userId: number; clinicId: number } | { status: number; error: string }
): result is { status: number; error: string } {
  return "error" in result;
}

async function buildExpenseResponse(expense: typeof expensesTable.$inferSelect) {
  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, expense.createdByUserId)).limit(1);
  return {
    id: expense.id,
    clinicId: expense.clinicId,
    category: expense.category,
    description: expense.description,
    amount: Number(expense.amount),
    period: expense.period,
    receiptUrl: expense.receiptUrl ?? null,
    createdByUserId: expense.createdByUserId,
    createdByName: creator?.name ?? "",
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

// ── Revenue ──────────────────────────────────────────────────────────────────

router.get("/finance/revenue", async (req: Request, res: Response): Promise<void> => {
  const authResult = await requireOwnerClinic(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const period = req.query.period as string | undefined;
  if (!period || !PERIOD_PATTERN.test(period)) {
    res.status(400).json({ error: "Parâmetro period (YYYY-MM) é obrigatório" });
    return;
  }

  const { start, end } = periodDateRange(period);
  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.clinicId, authResult.clinicId),
        gte(appointmentsTable.date, start),
        lte(appointmentsTable.date, end),
        ne(appointmentsTable.status, "cancelled")
      )
    )
    .orderBy(desc(appointmentsTable.date));

  const doctorIds = Array.from(new Set(rows.map((r) => r.doctorId)));
  const patientIds = Array.from(new Set(rows.map((r) => r.patientId)));
  const [doctorRows, patientRows] = await Promise.all([
    doctorIds.length
      ? db
          .select({ id: doctorsTable.id, userId: doctorsTable.userId })
          .from(doctorsTable)
          .where(eq(doctorsTable.clinicId, authResult.clinicId))
      : Promise.resolve([]),
    patientIds.length
      ? db
          .select({ id: patientsTable.id, userId: patientsTable.userId, paymentType: patientsTable.paymentType })
          .from(patientsTable)
      : Promise.resolve([]),
  ]);
  const userIds = Array.from(
    new Set([...doctorRows.map((d) => d.userId), ...patientRows.map((p) => p.userId)])
  );
  const userRows = userIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
    : [];
  const userNameById = new Map(userRows.map((u) => [u.id, u.name]));
  const doctorNameById = new Map(
    doctorRows.map((d) => [d.id, userNameById.get(d.userId) ?? ""])
  );
  const patientNameById = new Map(
    patientRows.map((p) => [p.id, userNameById.get(p.userId) ?? ""])
  );
  const patientTypeById = new Map(patientRows.map((p) => [p.id, p.paymentType ?? "particular"]));

  let totalPaid = 0;
  let totalPending = 0;
  const byType: Record<string, { paid: number; pending: number }> = {
    particular: { paid: 0, pending: 0 },
    convenio: { paid: 0, pending: 0 },
  };

  for (const appt of rows) {
    const amount = appt.amountCharged != null ? Number(appt.amountCharged) : 0;
    if (amount === 0) continue;
    const type = patientTypeById.get(appt.patientId) ?? "particular";
    if (!byType[type]) byType[type] = { paid: 0, pending: 0 };
    if (appt.isPaid) {
      totalPaid += amount;
      byType[type].paid += amount;
    } else {
      totalPending += amount;
      byType[type].pending += amount;
    }
  }

  const labels: Record<string, string> = { particular: "Particular", convenio: "Convênio" };

  res.json({
    period,
    totalRevenue: totalPaid + totalPending,
    totalPaid,
    totalPending,
    appointmentCount: rows.length,
    byPaymentType: Object.entries(byType).map(([type, v]) => ({
      label: labels[type] ?? type,
      paid: v.paid,
      pending: v.pending,
      total: v.paid + v.pending,
    })),
    appointments: rows.map((appt) => ({
      appointmentId: appt.id,
      date: appt.date,
      patientName: patientNameById.get(appt.patientId) ?? "",
      doctorName: doctorNameById.get(appt.doctorId) ?? "",
      amountCharged: appt.amountCharged != null ? Number(appt.amountCharged) : null,
      isPaid: appt.isPaid,
      paymentMethod: appt.paymentMethod ?? null,
    })),
  });
});

// ── Commissions ──────────────────────────────────────────────────────────────

router.get("/finance/commissions", async (req: Request, res: Response): Promise<void> => {
  const authResult = await requireOwnerClinic(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const period = req.query.period as string | undefined;
  if (!period || !PERIOD_PATTERN.test(period)) {
    res.status(400).json({ error: "Parâmetro period (YYYY-MM) é obrigatório" });
    return;
  }

  const { start, end } = periodDateRange(period);

  const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.clinicId, authResult.clinicId));

  const appointments = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.clinicId, authResult.clinicId),
        gte(appointmentsTable.date, start),
        lte(appointmentsTable.date, end),
        eq(appointmentsTable.isPaid, true),
        ne(appointmentsTable.status, "cancelled")
      )
    );

  const revenueByDoctor = new Map<number, number>();
  for (const appt of appointments) {
    const amount = appt.amountCharged != null ? Number(appt.amountCharged) : 0;
    revenueByDoctor.set(appt.doctorId, (revenueByDoctor.get(appt.doctorId) ?? 0) + amount);
  }

  const results = await Promise.all(
    doctors.map(async (doctor) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, doctor.userId)).limit(1);
      const revenue = revenueByDoctor.get(doctor.id) ?? 0;
      const commissionPercent = doctor.commissionPercent != null ? Number(doctor.commissionPercent) : 0;
      return {
        doctorId: doctor.id,
        doctorName: user?.name ?? "",
        commissionPercent,
        revenue,
        commissionAmount: Math.round(revenue * (commissionPercent / 100) * 100) / 100,
      };
    })
  );

  res.json(results);
});

// ── Summary (cash balance) ────────────────────────────────────────────────────

router.get("/finance/summary", async (req: Request, res: Response): Promise<void> => {
  const authResult = await requireOwnerClinic(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const period = req.query.period as string | undefined;
  if (!period || !PERIOD_PATTERN.test(period)) {
    res.status(400).json({ error: "Parâmetro period (YYYY-MM) é obrigatório" });
    return;
  }

  const { start, end } = periodDateRange(period);

  const appointments = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.clinicId, authResult.clinicId),
        gte(appointmentsTable.date, start),
        lte(appointmentsTable.date, end),
        eq(appointmentsTable.isPaid, true),
        ne(appointmentsTable.status, "cancelled")
      )
    );
  const totalRevenue = appointments.reduce(
    (sum, a) => sum + (a.amountCharged != null ? Number(a.amountCharged) : 0),
    0
  );

  const expenses = await db
    .select()
    .from(expensesTable)
    .where(and(eq(expensesTable.clinicId, authResult.clinicId), eq(expensesTable.period, period)));
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  res.json({
    period,
    totalRevenue,
    totalExpenses,
    cashBalance: Math.round((totalRevenue - totalExpenses) * 100) / 100,
  });
});

// ── Expenses ─────────────────────────────────────────────────────────────────

router.get("/finance/expenses", async (req: Request, res: Response): Promise<void> => {
  const authResult = await requireOwnerClinic(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const period = req.query.period as string | undefined;
  if (period !== undefined && !PERIOD_PATTERN.test(period)) {
    res.status(400).json({ error: "Parâmetro period inválido (esperado YYYY-MM)" });
    return;
  }

  const conditions = period
    ? and(eq(expensesTable.clinicId, authResult.clinicId), eq(expensesTable.period, period))
    : eq(expensesTable.clinicId, authResult.clinicId);

  const rows = await db.select().from(expensesTable).where(conditions).orderBy(desc(expensesTable.createdAt));
  const results = await Promise.all(rows.map(buildExpenseResponse));
  res.json(results);
});

router.post("/finance/expenses", async (req: Request, res: Response): Promise<void> => {
  const authResult = await requireOwnerClinic(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!PERIOD_PATTERN.test(parsed.data.period)) {
    res.status(400).json({ error: "period inválido (esperado YYYY-MM)" });
    return;
  }

  const [created] = await db
    .insert(expensesTable)
    .values({
      clinicId: authResult.clinicId,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount.toString(),
      period: parsed.data.period,
      receiptUrl: parsed.data.receiptUrl ?? null,
      createdByUserId: authResult.userId,
    })
    .returning();

  const result = await buildExpenseResponse(created);
  res.status(201).json(result);
});

router.patch("/finance/expenses/:expenseId", async (req: Request, res: Response): Promise<void> => {
  const authResult = await requireOwnerClinic(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.expenseId) ? req.params.expenseId[0] : req.params.expenseId;
  const expenseId = parseInt(raw, 10);

  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, expenseId)).limit(1);
  if (!expense) {
    res.status(404).json({ error: "Despesa não encontrada" });
    return;
  }
  if (expense.clinicId !== authResult.clinicId) {
    res.status(403).json({ error: "Esta despesa não pertence à sua clínica." });
    return;
  }

  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.period !== undefined && !PERIOD_PATTERN.test(parsed.data.period)) {
    res.status(400).json({ error: "period inválido (esperado YYYY-MM)" });
    return;
  }

  const { category, description, amount, period, receiptUrl } = parsed.data;

  await db
    .update(expensesTable)
    .set({
      ...(category !== undefined ? { category } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(amount !== undefined ? { amount: amount.toString() } : {}),
      ...(period !== undefined ? { period } : {}),
      ...(receiptUrl !== undefined ? { receiptUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(expensesTable.id, expenseId));

  const [updated] = await db.select().from(expensesTable).where(eq(expensesTable.id, expenseId)).limit(1);
  const result = await buildExpenseResponse(updated);
  res.json(result);
});

router.delete("/finance/expenses/:expenseId", async (req: Request, res: Response): Promise<void> => {
  const authResult = await requireOwnerClinic(req);
  if (isAuthError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const raw = Array.isArray(req.params.expenseId) ? req.params.expenseId[0] : req.params.expenseId;
  const expenseId = parseInt(raw, 10);

  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, expenseId)).limit(1);
  if (!expense) {
    res.status(404).json({ error: "Despesa não encontrada" });
    return;
  }
  if (expense.clinicId !== authResult.clinicId) {
    res.status(403).json({ error: "Esta despesa não pertence à sua clínica." });
    return;
  }

  await db.delete(expensesTable).where(eq(expensesTable.id, expenseId));
  res.status(204).send();
});

export default router;
