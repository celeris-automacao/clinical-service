import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth, isError, ensurePatientAccess } from "../lib/auth-helpers";
import { logger } from "../lib/logger";
import { AnalyzeMealBody, AnalyzeActivityBody, GeneratePatientSummaryBody } from "@workspace/api-zod";
import {
  db,
  checkInsTable,
  weightEntriesTable,
  sabotageNotesTable,
  patientsTable,
  usersTable,
  aiPatientSummariesTable,
} from "@workspace/db";
import { eq, and, gte, lte, asc, desc } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

/**
 * Build the full URL from the local objectPath or the incoming URL.
 * If the photoUrl starts with /objects/ or /public-objects/, prepend our
 * own storage serve endpoint (relative URL). Otherwise treat it as absolute.
 */
function resolvePhotoUrl(req: any, photoUrl: string): string {
  if (photoUrl.startsWith("/")) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["host"] || "localhost";
    return `${proto}://${host}/api/storage${photoUrl}`;
  }
  return photoUrl;
}

router.post("/ai/analyze-meal", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = AnalyzeMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { foodPhotoUrl, mealDescription, checkInId } = parsed.data;

  if (!foodPhotoUrl && !mealDescription?.trim()) {
    res.status(400).json({ error: "Informe uma foto ou uma descrição da refeição" });
    return;
  }

  const systemPrompt =
    "Você é um nutricionista especializado em estimativa nutricional. Analise " +
    (foodPhotoUrl ? "a imagem da refeição" : "a descrição da refeição") +
    " e responda EXATAMENTE neste formato:\n" +
    "Estimativa: ~X kcal\n" +
    "Proteínas: ~Xg\n" +
    "Carboidratos: ~Xg\n" +
    "Gorduras: ~Xg\n" +
    "Descrição: <breve descrição dos alimentos identificados>\n\n" +
    "Substitua X pelos valores inteiros estimados. Não omita nenhuma linha.";

  const userContent = foodPhotoUrl
    ? [
        {
          type: "image_url" as const,
          image_url: { url: resolvePhotoUrl(req, foodPhotoUrl), detail: "low" as const },
        },
      ]
    : `Refeição: ${mealDescription}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userContent as any,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const calMatch = text.match(/estimativa[:\s]+~?([\d.]+)\s*kcal/i);
    const estimate = calMatch ? Math.round(parseFloat(calMatch[1])) : null;
    const proteinMatch = text.match(/prote[ií]nas?[:\s]+~?([\d.]+)\s*g/i);
    const proteinG = proteinMatch ? Math.round(parseFloat(proteinMatch[1])) : null;
    const carbMatch = text.match(/carboidratos?[:\s]+~?([\d.]+)\s*g/i);
    const carbG = carbMatch ? Math.round(parseFloat(carbMatch[1])) : null;
    const fatMatch = text.match(/gorduras?[:\s]+~?([\d.]+)\s*g/i);
    const fatG = fatMatch ? Math.round(parseFloat(fatMatch[1])) : null;

    if (checkInId != null && estimate != null) {
      const checkInRows = await db
        .select()
        .from(checkInsTable)
        .where(eq(checkInsTable.id, checkInId))
        .limit(1);
      if (checkInRows.length === 0) {
        res.status(404).json({ error: "Check-in not found" });
        return;
      }
      const authorized = await ensurePatientAccess(authResult.user, checkInRows[0].patientId, authResult.clinicId);
      if (!authorized) {
        res.status(403).json({ error: "Not authorized to update this check-in" });
        return;
      }
      await db
        .update(checkInsTable)
        .set({ foodCalorieEstimate: estimate })
        .where(eq(checkInsTable.id, checkInId));
    }

    res.json({ estimate, text, proteinG, carbG, fatG });
  } catch (err: any) {
    logger.error({ err }, "meal analysis failed");
    res.status(502).json({ error: "Análise da refeição indisponível no momento" });
  }
});

router.post("/ai/analyze-activity", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const parsed = AnalyzeActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { exerciseDescription, checkInId } = parsed.data;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            "Você é um personal trainer especializado em metabolismo. Com base na descrição da atividade física, responda apenas com: 'Estimativa: ~X kcal' (onde X é um número inteiro), seguido de uma breve justificativa.",
        },
        {
          role: "user",
          content: `Atividade: ${exerciseDescription}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const match = text.match(/~?([\d.]+)\s*kcal/i);
    const estimate = match ? Math.round(parseFloat(match[1])) : null;

    if (checkInId != null && estimate != null) {
      const checkInRows = await db
        .select()
        .from(checkInsTable)
        .where(eq(checkInsTable.id, checkInId))
        .limit(1);
      if (checkInRows.length === 0) {
        res.status(404).json({ error: "Check-in not found" });
        return;
      }
      const authorized = await ensurePatientAccess(authResult.user, checkInRows[0].patientId, authResult.clinicId);
      if (!authorized) {
        res.status(403).json({ error: "Not authorized to update this check-in" });
        return;
      }
      await db
        .update(checkInsTable)
        .set({ exerciseCalorieEstimate: estimate, exerciseDescription })
        .where(eq(checkInsTable.id, checkInId));
    }

    res.json({ estimate, text });
  } catch (err: any) {
    logger.error({ err }, "activity analysis failed");
    res.status(502).json({ error: "Análise da atividade indisponível no momento" });
  }
});

router.post("/ai/patient-summary", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  if (authResult.user.role === "patient") {
    res.status(403).json({ error: "Apenas profissionais de saúde podem gerar resumos" });
    return;
  }

  const parsed = GeneratePatientSummaryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { patientId, startDate: startDateRaw, endDate: endDateRaw } = parsed.data;
  const startDate = startDateRaw ? startDateRaw.toISOString().split("T")[0] : undefined;
  const endDate = endDateRaw ? endDateRaw.toISOString().split("T")[0] : undefined;

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado ou acesso negado" });
    return;
  }

  const patientUserRows = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, patient.userId))
    .limit(1);

  const patientUser = patientUserRows[0];
  const patientName = patientUser?.name ?? `Paciente #${patientId}`;

  const checkInWhere: any[] = [eq(checkInsTable.patientId, patientId)];
  if (startDate) checkInWhere.push(gte(checkInsTable.date, startDate));
  if (endDate) checkInWhere.push(lte(checkInsTable.date, endDate));

  const weightWhere: any[] = [eq(weightEntriesTable.patientId, patientId)];
  if (startDate) weightWhere.push(gte(weightEntriesTable.date, startDate));
  if (endDate) weightWhere.push(lte(weightEntriesTable.date, endDate));

  const sabotageWhere: any[] = [eq(sabotageNotesTable.patientId, patientId)];
  if (startDate) sabotageWhere.push(gte(sabotageNotesTable.date, startDate));
  if (endDate) sabotageWhere.push(lte(sabotageNotesTable.date, endDate));

  const [checkIns, weightEntries, sabotageNotes, patientRows] = await Promise.all([
    db
      .select()
      .from(checkInsTable)
      .where(and(...checkInWhere))
      .orderBy(asc(checkInsTable.date))
      .limit(200),
    db
      .select()
      .from(weightEntriesTable)
      .where(and(...weightWhere))
      .orderBy(asc(weightEntriesTable.date))
      .limit(100),
    db
      .select()
      .from(sabotageNotesTable)
      .where(and(...sabotageWhere))
      .orderBy(asc(sabotageNotesTable.date))
      .limit(50),
    db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId))
      .limit(1),
  ]);

  if (checkIns.length === 0 && weightEntries.length === 0 && sabotageNotes.length === 0) {
    res.json({
      summary: "Não há dados suficientes neste período para gerar um resumo.",
      savedId: null,
    });
    return;
  }

  const patientRecord = patientRows[0];
  const startWeight = patientRecord?.startWeight ?? null;
  const targetWeight = patientRecord?.targetWeight ?? null;
  const latestWeight =
    weightEntries.length > 0 ? weightEntries[weightEntries.length - 1]?.weightKg : null;

  const periodLabel =
    startDate || endDate
      ? `${startDate ?? "início"} até ${endDate ?? "hoje"}`
      : "histórico completo";

  const checkInSummaryLines = checkIns.map((ci) => {
    const goals = [
      ci.didExercise ? "exercício ✓" : "exercício ✗",
      ci.drankWater ? "água ✓" : "água ✗",
      ci.ateWell ? "alimentação ✓" : "alimentação ✗",
    ].join(", ");
    const extras: string[] = [];
    if (ci.note) extras.push(`nota: "${ci.note}"`);
    if (ci.exerciseDescription) extras.push(`atividade: ${ci.exerciseDescription}`);
    if (ci.foodCalorieEstimate != null) extras.push(`~${ci.foodCalorieEstimate} kcal refeição`);
    if (ci.exerciseCalorieEstimate != null) extras.push(`~${ci.exerciseCalorieEstimate} kcal gasto`);
    return `  ${ci.date}: ${goals}${extras.length ? " | " + extras.join("; ") : ""}`;
  });

  const weightLines = weightEntries.map(
    (w) => `  ${w.date}: ${Number(w.weightKg).toFixed(1)} kg${w.note ? ` — ${w.note}` : ""}`,
  );

  const sabotageLines = sabotageNotes.map(
    (s) =>
      `  ${s.date}: motivo="${s.reason}"${s.whatHappened ? `, relato="${s.whatHappened}"` : ""}`,
  );

  const totalCheckIns = checkIns.length;
  const fullCheckIns = checkIns.filter((ci) => ci.didExercise && ci.drankWater && ci.ateWell).length;
  const completionRate =
    totalCheckIns > 0 ? Math.round((fullCheckIns / totalCheckIns) * 100) : 0;

  const prompt = `Você é um assistente clínico especializado em emagrecimento saudável. Escreva um resumo clínico detalhado e acionável da evolução do paciente abaixo, em português do Brasil.

O resumo deve:
- Ser direto e útil para o profissional de saúde
- Destacar pontos positivos e padrões de melhora
- Identificar dificuldades recorrentes e fatores de sabotagem
- Comentar sobre a evolução do peso (se disponível)
- Sugerir áreas de atenção para as próximas consultas
- Ter no máximo 400 palavras

Se os dados forem insuficientes para gerar um resumo útil, informe isso de forma amigável e direta.

PACIENTE: ${patientName}
PERÍODO ANALISADO: ${periodLabel}
PESO INICIAL: ${startWeight != null ? `${Number(startWeight).toFixed(1)} kg` : "não informado"}
META DE PESO: ${targetWeight != null ? `${Number(targetWeight).toFixed(1)} kg` : "não definida"}
PESO MAIS RECENTE NO PERÍODO: ${latestWeight != null ? `${Number(latestWeight).toFixed(1)} kg` : "sem registro"}

CHECK-INS (${totalCheckIns} registros, ${completionRate}% com todas as metas completas):
${checkInSummaryLines.length > 0 ? checkInSummaryLines.join("\n") : "  Nenhum check-in no período."}

EVOLUÇÃO DE PESO (${weightLines.length} registros):
${weightLines.length > 0 ? weightLines.join("\n") : "  Nenhum registro de peso no período."}

NOTAS DE SABOTAGEM (${sabotageLines.length} registros):
${sabotageLines.length > 0 ? sabotageLines.join("\n") : "  Nenhuma nota de sabotagem no período."}`;

  const { saveSummary } = parsed.data;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: "Você é um assistente clínico especializado em emagrecimento." },
        { role: "user", content: prompt },
      ],
    });

    const summary = completion.choices[0]?.message?.content ?? "";

    let savedId: number | null = null;
    if (saveSummary) {
      const [inserted] = await db
        .insert(aiPatientSummariesTable)
        .values({
          patientId,
          generatedBy: authResult.user.id,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          summaryText: summary,
        })
        .returning({ id: aiPatientSummariesTable.id });
      savedId = inserted?.id ?? null;
    }

    res.json({ summary, savedId: savedId ?? null });
  } catch (err: any) {
    logger.error({ err }, "patient summary generation failed");
    res.status(502).json({ error: "Resumo de IA indisponível no momento. Tente novamente." });
  }
});

router.get("/patients/:patientId/ai-summaries", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  if (authResult.user.role === "patient") {
    res.status(403).json({ error: "Apenas profissionais de saúde podem consultar resumos" });
    return;
  }

  const patientId = Number(req.params.patientId);
  if (!Number.isInteger(patientId) || patientId <= 0) {
    res.status(400).json({ error: "patientId inválido" });
    return;
  }

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado ou acesso negado" });
    return;
  }

  const summaries = await db
    .select()
    .from(aiPatientSummariesTable)
    .where(eq(aiPatientSummariesTable.patientId, patientId))
    .orderBy(desc(aiPatientSummariesTable.createdAt))
    .limit(50);

  res.json(summaries);
});

const UpdateNotesBody = z.object({
  doctorNotes: z.string().nullable(),
});

router.delete("/patients/:patientId/ai-summaries/:summaryId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { role } = authResult.user;
  if (role === "patient") {
    res.status(403).json({ error: "Apenas profissionais de saúde podem remover resumos" });
    return;
  }

  const patientId = Number(req.params.patientId);
  const summaryId = Number(req.params.summaryId);
  if (!Number.isInteger(patientId) || patientId <= 0 || !Number.isInteger(summaryId) || summaryId <= 0) {
    res.status(400).json({ error: "parâmetros inválidos" });
    return;
  }

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado ou acesso negado" });
    return;
  }

  const deleted = await db
    .delete(aiPatientSummariesTable)
    .where(and(eq(aiPatientSummariesTable.id, summaryId), eq(aiPatientSummariesTable.patientId, patientId)))
    .returning({ id: aiPatientSummariesTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Resumo não encontrado" });
    return;
  }

  res.status(204).send();
});

router.patch("/patients/:patientId/ai-summaries/:summaryId", async (req, res): Promise<void> => {
  const authResult = await requireAuth(req);
  if (isError(authResult)) {
    res.status(authResult.status).json({ error: authResult.error });
    return;
  }

  const { role } = authResult.user;
  if (role === "patient") {
    res.status(403).json({ error: "Apenas profissionais de saúde podem anotar resumos" });
    return;
  }

  const patientId = Number(req.params.patientId);
  const summaryId = Number(req.params.summaryId);
  if (!Number.isInteger(patientId) || patientId <= 0 || !Number.isInteger(summaryId) || summaryId <= 0) {
    res.status(400).json({ error: "parâmetros inválidos" });
    return;
  }

  const parsed = UpdateNotesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const patient = await ensurePatientAccess(authResult.user, patientId, authResult.clinicId);
  if (!patient) {
    res.status(404).json({ error: "Paciente não encontrado ou acesso negado" });
    return;
  }

  const updated = await db
    .update(aiPatientSummariesTable)
    .set({ doctorNotes: parsed.data.doctorNotes })
    .where(and(eq(aiPatientSummariesTable.id, summaryId), eq(aiPatientSummariesTable.patientId, patientId)))
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "Resumo não encontrado" });
    return;
  }

  res.json(updated[0]);
});

export default router;
