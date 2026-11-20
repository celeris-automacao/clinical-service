import { Resend } from "resend";
import { logger } from "./logger";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@clinicainbox.com.br";
const DEFAULT_CLINIC_NAME = "";

export async function sendInviteEmail(opts: {
  to: string;
  name: string;
  tempPassword: string;
  clinicName?: string | null;
  senderName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
}) {
  const { to, name, tempPassword, clinicName, senderName, fromEmail, replyToEmail } = opts;

  const displayClinicName = clinicName ?? DEFAULT_CLINIC_NAME;
  const fromName = senderName ?? displayClinicName;
  const fromAddress = fromEmail ?? DEFAULT_FROM_EMAIL;
  const from = `${fromName} <${fromAddress}>`;

  if (!resend) {
    logger.warn(
      { to, tempPassword },
      `[EMAIL - sem RESEND_API_KEY] Convite para ${to}: ${tempPassword}`
    );
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <div style="background:#16a34a;padding:28px 32px 24px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${displayClinicName}</h1>
          <p style="margin:6px 0 0;color:#bbf7d0;font-size:14px;">Eficiência Operacional e Cuidado Integrado</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="margin:0 0 6px;font-size:16px;color:#111827;">Olá, <strong>${name}</strong>! 👋</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            Sua conta foi criada na <strong>${displayClinicName}</strong>. Baixe o aplicativo e siga os passos abaixo para começar.
          </p>

          <!-- Step 1 -->
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 20px;margin-bottom:16px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px;">Passo 1 — Baixe o app</p>
            <p style="margin:0 0 12px;font-size:14px;color:#374151;">Procure por <strong>${displayClinicName}</strong> na loja do seu celular:</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <span style="display:inline-block;background:#000;color:#fff;border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;">🍎 App Store (iPhone)</span>
              <span style="display:inline-block;background:#1a73e8;color:#fff;border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;">▶ Google Play (Android)</span>
            </div>
          </div>

          <!-- Step 2 -->
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 20px;margin-bottom:16px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px;">Passo 2 — Faça seu primeiro login</p>
            <p style="margin:0 0 4px;font-size:14px;color:#374151;">Você pode entrar de 3 formas:</p>

            <!-- Option A: Apple -->
            <div style="display:flex;align-items:center;gap:8px;margin:10px 0 4px;">
              <span style="font-size:18px;">🍎</span>
              <span style="font-size:14px;color:#374151;"><strong>iPhone:</strong> toque em "Entrar com Apple" e use seu Apple ID</span>
            </div>

            <!-- Option B: Google -->
            <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
              <span style="font-size:18px;">🟦</span>
              <span style="font-size:14px;color:#374151;"><strong>Android:</strong> toque em "Entrar com Google" e use sua conta Google</span>
            </div>

            <!-- Option C: Email/Senha -->
            <div style="border-top:1px solid #bbf7d0;margin:14px 0 10px;"></div>
            <p style="margin:0 0 6px;font-size:14px;color:#374151;">Ou entre com <strong>email e senha</strong>:</p>
            <p style="margin:2px 0;font-size:13px;color:#6b7280;">E-mail: <strong style="color:#111;">${to}</strong></p>
            <p style="margin:2px 0 10px;font-size:13px;color:#6b7280;">Senha temporária:</p>
            <div style="background:#fff;border:2px solid #16a34a;border-radius:8px;padding:14px;text-align:center;">
              <span style="font-size:26px;font-weight:800;letter-spacing:5px;color:#16a34a;font-family:monospace;">${tempPassword}</span>
            </div>
            <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">Após entrar com essa senha, o app pedirá para criar uma senha pessoal.</p>
          </div>

          <!-- Note -->
          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
            💡 Se entrar com Google ou Apple usando este e-mail (<strong>${to}</strong>), o acesso é liberado automaticamente — sem precisar da senha temporária.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Se você não solicitou este acesso, ignore este email. © ${displayClinicName}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from,
    to,
    subject: `Você foi convidado para o ${displayClinicName} — acesse o app`,
    html,
  };

  if (replyToEmail) {
    emailPayload.replyTo = replyToEmail;
  }

  const { error } = await resend.emails.send(emailPayload);

  if (error) {
    logger.error({ error, to }, "Failed to send invite email");
    throw new Error("Não foi possível enviar o email de convite");
  }
}

export async function sendTempPasswordEmail(opts: {
  to: string;
  name: string;
  tempPassword: string;
  clinicName?: string | null;
  senderName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
}) {
  return sendInviteEmail(opts);
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  resetUrl: string;
  clinicName?: string | null;
  senderName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
}) {
  const { to, name, resetUrl, clinicName, senderName, fromEmail, replyToEmail } = opts;

  const displayClinicName = clinicName ?? DEFAULT_CLINIC_NAME;
  const fromName = senderName ?? displayClinicName;
  const fromAddress = fromEmail ?? DEFAULT_FROM_EMAIL;
  const from = `${fromName} <${fromAddress}>`;

  if (!resend) {
    logger.warn(
      { to, resetUrl },
      `[EMAIL - sem RESEND_API_KEY] Reset de senha para ${to}: ${resetUrl}`
    );
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <div style="background:#16a34a;padding:28px 32px 24px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${displayClinicName}</h1>
          <p style="margin:6px 0 0;color:#bbf7d0;font-size:14px;">Eficiência Operacional e Cuidado Integrado</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="margin:0 0 6px;font-size:16px;color:#111827;">Olá, <strong>${name}</strong>!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            Recebemos uma solicitação para redefinir a senha da sua conta no painel da <strong>${displayClinicName}</strong>.
            Clique no botão abaixo para criar uma nova senha.
          </p>

          <!-- CTA Button -->
          <div style="text-align:center;margin:24px 0;">
            <a href="${resetUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;border-radius:10px;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:.3px;">
              Redefinir minha senha
            </a>
          </div>

          <!-- Fallback link -->
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin-top:20px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#15803d;">Link não funcionou?</p>
            <p style="margin:0 0 8px;font-size:13px;color:#374151;">Copie e cole o link abaixo no seu navegador:</p>
            <p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all;">${resetUrl}</p>
          </div>

          <!-- Expiry warning -->
          <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;line-height:1.5;">
            ⏱ Este link é válido por <strong>1 hora</strong> e pode ser usado apenas uma vez.
            Se você não solicitou a redefinição de senha, ignore este email — sua senha permanece a mesma.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${displayClinicName} — Painel de gestão clínica</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from,
    to,
    subject: `Redefinição de senha — ${displayClinicName}`,
    html,
  };

  if (replyToEmail) {
    emailPayload.replyTo = replyToEmail;
  }

  const { error } = await resend.emails.send(emailPayload);

  if (error) {
    logger.error({ error, to }, "Failed to send password reset email");
    throw new Error("Não foi possível enviar o email de redefinição");
  }
}

export async function sendPlanLimitAlertEmail(opts: {
  to: string;
  ownerName: string;
  threshold: "90" | "100";
  planLabel: string;
  doctorCount: number;
  doctorLimit: number;
  clinicName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
}) {
  const { to, ownerName, threshold, planLabel, doctorCount, doctorLimit, clinicName, fromEmail, replyToEmail } = opts;

  const displayClinicName = clinicName ?? DEFAULT_CLINIC_NAME;
  const fromAddress = fromEmail ?? DEFAULT_FROM_EMAIL;
  const from = `${displayClinicName} <${fromAddress}>`;

  const isReached = threshold === "100";
  const accentColor = isReached ? "#dc2626" : "#d97706";
  const accentBg = isReached ? "#fef2f2" : "#fffbeb";
  const accentBorder = isReached ? "#fecaca" : "#fde68a";
  const title = isReached
    ? "Limite de profissionais atingido"
    : "Você está perto do limite de profissionais";
  const message = isReached
    ? `Sua clínica atingiu o limite de <strong>${doctorLimit}</strong> profissionais do plano <strong>${planLabel}</strong> (${doctorCount}/${doctorLimit}). Não é mais possível cadastrar novos profissionais até que você faça upgrade do plano.`
    : `Sua clínica já tem <strong>${doctorCount}</strong> de <strong>${doctorLimit}</strong> profissionais cadastrados no plano <strong>${planLabel}</strong>. Considere fazer upgrade antes de atingir o limite.`;

  if (!resend) {
    logger.warn(
      { to, threshold, doctorCount, doctorLimit },
      `[EMAIL - sem RESEND_API_KEY] Alerta de limite de plano (${threshold}%) para ${to}`
    );
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <div style="background:${accentColor};padding:28px 32px 24px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${displayClinicName}</h1>
          <p style="margin:6px 0 0;color:#fff;opacity:0.85;font-size:14px;">Alerta de uso do plano</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="margin:0 0 6px;font-size:16px;color:#111827;">Olá, <strong>${ownerName}</strong>!</p>
          <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">${message}</p>

          <div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:.5px;">${title}</p>
            <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#111827;">${doctorCount} / ${doctorLimit}</p>
            <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">profissionais cadastrados</p>
          </div>

          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
            Acesse o painel em "Plano &amp; Uso" para revisar os planos disponíveis e fazer upgrade quando quiser.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${displayClinicName} — Painel de gestão clínica</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from,
    to,
    subject: isReached
      ? `⚠️ Limite de profissionais atingido — ${displayClinicName}`
      : `Atenção: perto do limite de profissionais — ${displayClinicName}`,
    html,
  };

  if (replyToEmail) {
    emailPayload.replyTo = replyToEmail;
  }

  const { error } = await resend.emails.send(emailPayload);

  if (error) {
    logger.error({ error, to, threshold }, "Failed to send plan limit alert email");
    throw new Error("Não foi possível enviar o email de alerta de limite de plano");
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

export async function sendCommunityContentRemovedEmail(opts: {
  to: string;
  name: string;
  clinicName?: string | null;
  contentType: "comment" | "post";
}): Promise<boolean> {
  const clinicName = opts.clinicName?.trim() || "sua clínica";
  if (!resend) {
    logger.warn(
      { to: opts.to, contentType: opts.contentType },
      "Community moderation notice not sent because RESEND_API_KEY is not configured"
    );
    return false;
  }

  const contentLabel = opts.contentType === "comment" ? "comentário" : "publicação";
  const safeName = escapeHtml(opts.name);
  const safeClinicName = escapeHtml(clinicName);
  const { error } = await resend.emails.send({
    from: `Modula Clinic <${DEFAULT_FROM_EMAIL}>`,
    to: opts.to,
    subject: `Conteúdo removido da comunidade de ${clinicName}`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
      <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <main style="max-width:560px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
          <h1 style="font-size:20px;margin:0 0 16px;">Aviso sobre sua participação na comunidade</h1>
          <p>Olá, ${safeName}.</p>
          <p>Um moderador removeu seu ${contentLabel} da comunidade de <strong>${safeClinicName}</strong> após revisão, por entender que ele não estava de acordo com as regras da comunidade.</p>
          <p>Pedimos que mantenha as próximas interações respeitosas, acolhedoras e relacionadas à comunidade. Se acreditar que houve um engano, entre em contato com a equipe da clínica.</p>
        </main>
      </body>
      </html>
    `,
  });

  if (error) {
    logger.error({ error, to: opts.to, contentType: opts.contentType }, "Failed to send community moderation notice");
    throw new Error("Não foi possível enviar o aviso de moderação da comunidade");
  }
  return true;
}

export async function sendEnterprisePlanInquiryEmail(opts: {
  to: string[];
  clinicName: string;
  ownerName: string;
  ownerEmail: string;
  message?: string;
}) {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const clinicName = escapeHtml(opts.clinicName);
  const ownerName = escapeHtml(opts.ownerName);
  const ownerEmail = escapeHtml(opts.ownerEmail);
  const message = opts.message ? escapeHtml(opts.message) : "";

  const { data, error } = await resend.emails.send({
    from: `Modula Clinic <${DEFAULT_FROM_EMAIL}>`,
    to: opts.to,
    replyTo: opts.ownerEmail,
    subject: "Solicitação de contato sobre o plano Enterprise",
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
      <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <main style="max-width:560px;margin:0 auto;padding:28px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;">
          <h1 style="margin:0 0 8px;font-size:22px;">Interesse no plano Enterprise</h1>
          <p style="margin:0 0 24px;color:#475569;">Uma clínica solicitou contato comercial pelo painel.</p>
          <dl style="margin:0;">
            <dt style="font-weight:700;">Clínica</dt>
            <dd style="margin:4px 0 16px;">${clinicName}</dd>
            <dt style="font-weight:700;">Responsável</dt>
            <dd style="margin:4px 0 16px;">${ownerName}</dd>
            <dt style="font-weight:700;">E-mail para retorno</dt>
            <dd style="margin:4px 0 16px;"><a href="mailto:${ownerEmail}">${ownerEmail}</a></dd>
            ${message ? `<dt style="font-weight:700;">Mensagem</dt><dd style="margin:4px 0 0;white-space:pre-wrap;">${message}</dd>` : ""}
          </dl>
        </main>
      </body>
      </html>
    `,
  });

  if (error || !data?.id) {
    logger.error({ error, recipientCount: opts.to.length }, "Failed to send Enterprise plan inquiry email");
    throw new Error("Não foi possível enviar a solicitação de contato comercial");
  }

  logger.info(
    { emailId: data.id, recipientCount: opts.to.length },
    "Enterprise plan inquiry email accepted by provider",
  );
  return data.id;
}

export async function sendDeletionRequestNotificationEmail(opts: {
  to: string;
  ownerName: string;
  patientName: string;
  requestedAt: Date;
  clinicName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
  isResubmission?: boolean;
}) {
  const { to, ownerName, patientName, requestedAt, clinicName, fromEmail, replyToEmail, isResubmission = false } = opts;

  const displayClinicName = clinicName ?? DEFAULT_CLINIC_NAME;
  const fromAddress = fromEmail ?? DEFAULT_FROM_EMAIL;
  const from = `${displayClinicName} <${fromAddress}>`;

  const requestDateStr = requestedAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const deadline = new Date(requestedAt);
  deadline.setDate(deadline.getDate() + 30);
  const deadlineDateStr = deadline.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (!resend) {
    logger.warn(
      { to, patientName, requestedAt, isResubmission },
      `[EMAIL - sem RESEND_API_KEY] ${isResubmission ? "Re-solicitação" : "Solicitação"} de exclusão de dados (LGPD) de ${patientName} para ${to}`
    );
    return;
  }

  const resubmissionBanner = isResubmission
    ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">⚠️ Re-solicitação</p>
        <p style="margin:6px 0 0;font-size:13px;color:#78350f;line-height:1.5;">
          Este paciente já havia feito uma solicitação anterior que foi cancelada. Esta é uma nova solicitação e deve ser tratada dentro do prazo legal.
        </p>
      </div>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <div style="background:#dc2626;padding:28px 32px 24px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${displayClinicName}</h1>
          <p style="margin:6px 0 0;color:#fca5a5;font-size:14px;">${isResubmission ? "Re-solicitação de exclusão de dados — LGPD Art. 18" : "Solicitação de exclusão de dados — LGPD Art. 18"}</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="margin:0 0 6px;font-size:16px;color:#111827;">Olá, <strong>${ownerName}</strong>!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            O paciente abaixo solicitou a exclusão dos seus dados pessoais com base no Art. 18 da LGPD.
            Você tem até <strong>${deadlineDateStr}</strong> (30 dias) para responder a esta solicitação.
          </p>

          ${resubmissionBanner}

          <!-- Request details -->
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.5px;">Detalhes da solicitação</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#6b7280;width:40%;">Paciente:</td>
                <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827;">${patientName}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#6b7280;">Data da solicitação:</td>
                <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827;">${requestDateStr}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#6b7280;">Prazo para resposta:</td>
                <td style="padding:5px 0;font-size:13px;font-weight:700;color:#dc2626;">${deadlineDateStr}</td>
              </tr>
            </table>
          </div>

          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
            Acesse o painel da clínica em <strong>Conformidade LGPD</strong> para aprovar ou cancelar esta solicitação dentro do prazo legal.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${displayClinicName} — Painel de gestão clínica</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from,
    to,
    subject: isResubmission
      ? `⚠️ [Re-solicitação] Exclusão de dados (LGPD) — ${patientName}`
      : `⚠️ Solicitação de exclusão de dados (LGPD) — ${patientName}`,
    html,
  };

  if (replyToEmail) {
    emailPayload.replyTo = replyToEmail;
  }

  const { error } = await resend.emails.send(emailPayload);

  if (error) {
    logger.error({ error, to, patientName }, "Failed to send deletion request notification email");
    throw new Error("Não foi possível enviar o email de notificação de exclusão de dados");
  }
}

export async function sendAuditFailureAlertEmail(opts: {
  to: string;
  ownerName: string;
  clinicName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
  errorMessage: string;
  accessorUserId: number;
  accessorRole: string;
  patientId: number | null;
  failedAt: Date;
}) {
  const { to, ownerName, clinicName, fromEmail, replyToEmail, errorMessage, accessorUserId, accessorRole, patientId, failedAt } = opts;

  const displayClinicName = clinicName ?? DEFAULT_CLINIC_NAME;
  const fromAddress = fromEmail ?? DEFAULT_FROM_EMAIL;
  const from = `${displayClinicName} <${fromAddress}>`;

  const failedAtStr = failedAt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  if (!resend) {
    logger.warn(
      { to, accessorUserId, accessorRole, patientId, errorMessage },
      `[EMAIL - sem RESEND_API_KEY] Alerta de falha no registro de auditoria LGPD para ${to}`
    );
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <div style="background:#dc2626;padding:28px 32px 24px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${displayClinicName}</h1>
          <p style="margin:6px 0 0;color:#fca5a5;font-size:14px;">Alerta de conformidade — LGPD Art. 37</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="margin:0 0 6px;font-size:16px;color:#111827;">Olá, <strong>${ownerName}</strong>!</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            Uma falha crítica foi detectada no sistema de registro de acessos a dados sensíveis (LGPD Art. 37).
            Um ou mais registros de auditoria <strong>não foram gravados</strong> no banco de dados.
            Ação imediata pode ser necessária para manter a conformidade legal.
          </p>

          <!-- Alert box -->
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:20px;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.5px;">⚠️ Falha no registro de auditoria</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#6b7280;width:40%;vertical-align:top;">Data/hora:</td>
                <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827;">${failedAtStr}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#6b7280;vertical-align:top;">Papel do acesso:</td>
                <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827;">${accessorRole}</td>
              </tr>
              ${patientId != null ? `<tr>
                <td style="padding:5px 0;font-size:13px;color:#6b7280;vertical-align:top;">Paciente (ID):</td>
                <td style="padding:5px 0;font-size:13px;font-weight:600;color:#111827;">#${patientId}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:5px 0;font-size:13px;color:#6b7280;vertical-align:top;">Erro técnico:</td>
                <td style="padding:5px 0;font-size:13px;color:#dc2626;word-break:break-all;">${errorMessage}</td>
              </tr>
            </table>
          </div>

          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
            Acesse o painel em <strong>Conformidade LGPD</strong> para visualizar o log de falhas de auditoria e tomar as providências necessárias.
            Se o problema persistir, entre em contato com o suporte técnico da plataforma.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${displayClinicName} — Painel de gestão clínica</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from,
    to,
    subject: `🚨 Falha no registro de auditoria LGPD — ${displayClinicName}`,
    html,
  };

  if (replyToEmail) {
    emailPayload.replyTo = replyToEmail;
  }

  const { error } = await resend.emails.send(emailPayload);

  if (error) {
    logger.error({ error, to }, "Failed to send audit failure alert email");
    throw new Error("Não foi possível enviar o email de alerta de falha de auditoria");
  }
}

export async function sendBirthdayNotificationEmail(opts: {
  to: string;
  staffName: string;
  patientName: string;
  age: number;
  clinicName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
}) {
  const { to, staffName, patientName, age, clinicName, fromEmail, replyToEmail } = opts;

  const displayClinicName = clinicName ?? DEFAULT_CLINIC_NAME;
  const fromAddress = fromEmail ?? DEFAULT_FROM_EMAIL;
  const from = `${displayClinicName} <${fromAddress}>`;

  if (!resend) {
    logger.info(
      { to, patientName, age },
      `[EMAIL - sem RESEND_API_KEY] Aniversário: ${patientName} completa ${age} anos hoje`
    );
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;">
      <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <div style="background:#16a34a;padding:28px 32px 24px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${displayClinicName}</h1>
          <p style="margin:6px 0 0;color:#bbf7d0;font-size:14px;">Notificação de aniversário</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="margin:0 0 6px;font-size:16px;color:#111827;">Olá, <strong>${staffName}</strong>! 👋</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            Um dos seus pacientes faz aniversário hoje. Que tal enviar uma mensagem especial?
          </p>

          <!-- Birthday card -->
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
            <div style="font-size:48px;margin-bottom:12px;">🎂</div>
            <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#15803d;">${patientName}</p>
            <p style="margin:0;font-size:15px;color:#374151;">
              está completando <strong>${age} ${age === 1 ? "ano" : "anos"}</strong> hoje!
            </p>
          </div>

          <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.5;">
            Este é um aviso automático da plataforma <strong>${displayClinicName}</strong>.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">© ${displayClinicName} — Painel de gestão clínica</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from,
    to,
    subject: `🎂 Aniversário de ${patientName} hoje — ${displayClinicName}`,
    html,
  };

  if (replyToEmail) {
    emailPayload.replyTo = replyToEmail;
  }

  const { error } = await resend.emails.send(emailPayload);

  if (error) {
    logger.error({ error, to, patientName }, "Failed to send birthday notification email");
    throw new Error("Não foi possível enviar o email de aniversário");
  }
}

export async function sendAppointmentConfirmationEmail(opts: {
  to: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  date: string;
  startTime: string;
  confirmationUrl: string;
  appointmentId: number;
}): Promise<boolean> {
  if (!resend) {
    logger.warn(
      { appointmentId: opts.appointmentId },
      "Appointment confirmation email not sent because RESEND_API_KEY is not configured"
    );
    return false;
  }

  const appUrl =
    process.env.APP_URL ??
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.NODE_ENV === "production"
        ? null
        : "http://127.0.0.1:5177");
  if (!appUrl) {
    throw new Error("APP_URL is required to send appointment confirmation emails in production");
  }

  const confirmationUrl = new URL(opts.confirmationUrl, appUrl).toString();
  const patientName = escapeHtml(opts.patientName);
  const doctorName = escapeHtml(opts.doctorName);
  const clinicName = escapeHtml(opts.clinicName || "sua clínica");
  const date = escapeHtml(opts.date.split("-").reverse().join("/"));
  const startTime = escapeHtml(opts.startTime);
  const safeConfirmationUrl = escapeHtml(confirmationUrl);

  const { error } = await resend.emails.send({
    from: `${opts.clinicName || "Modula Clinic"} <${DEFAULT_FROM_EMAIL}>`,
    to: opts.to,
    subject: `Confirme sua consulta de ${date} — ${clinicName}`,
    text: [
      `Olá, ${opts.patientName}.`,
      `Você tem uma consulta com ${opts.doctorName} em ${date} às ${opts.startTime}.`,
      `Confirme sua presença: ${confirmationUrl}`,
      "Se não houver confirmação, a clínica poderá cancelar a consulta. O cancelamento não é automático; a equipe da clínica avaliará cada caso.",
      `Atenciosamente, ${opts.clinicName || "sua clínica"}.`,
    ].join("\n\n"),
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
      <body style="margin:0;padding:24px;background:#f9fafb;font-family:'Segoe UI',Arial,sans-serif;color:#111827;">
        <main style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
          <h1 style="margin:0 0 20px;font-size:22px;">Confirme sua consulta</h1>
          <p>Olá, <strong>${patientName}</strong>.</p>
          <p>Você tem uma consulta com <strong>${doctorName}</strong> em <strong>${date}</strong>, às <strong>${startTime}</strong>.</p>
          <p style="margin:24px 0;">
            <a href="${safeConfirmationUrl}" style="display:inline-block;padding:12px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
              Confirmar consulta
            </a>
          </p>
          <p style="font-size:14px;color:#4b5563;">Se não houver confirmação, a clínica poderá cancelar a consulta. O cancelamento não é automático; a equipe da clínica avaliará cada caso.</p>
          <p style="font-size:14px;color:#6b7280;">Atenciosamente,<br /><strong>${clinicName}</strong></p>
        </main>
      </body>
      </html>
    `,
  });

  if (error) {
    logger.error({ error, appointmentId: opts.appointmentId }, "Failed to send appointment confirmation email");
    throw new Error("Não foi possível enviar o e-mail de confirmação da consulta");
  }
  return true;
}
