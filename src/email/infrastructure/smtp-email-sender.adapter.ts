import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EmailSenderPort, StaffInvitationEmail } from '../application/ports/email-sender.port';

@Injectable()
export class SmtpEmailSenderAdapter implements EmailSenderPort {
  private readonly logger = new Logger(SmtpEmailSenderAdapter.name);
  private transporter?: Transporter;
  private from?: string;
  private invitationAppUrl?: URL;

  async verifyConnection(): Promise<void> {
    const { transporter } = this.getConfig();
    try {
      await transporter.verify();
    } catch (error) {
      this.logger.error('Não foi possível validar a conexão SMTP.', error);
      throw new ServiceUnavailableException(
        'Não foi possível validar a conexão SMTP. Confira as configurações do ambiente.',
      );
    }
  }

  async sendStaffInvitation(invitation: StaffInvitationEmail): Promise<void> {
    const config = this.getConfig();
    const invitationUrl = new URL(config.invitationAppUrl);
    invitationUrl.hash = `invite/${encodeURIComponent(invitation.token)}`;

    try {
      await config.transporter.sendMail({
        from: config.from,
        to: invitation.email,
        subject: 'Convite para a equipe HealthQuest',
        text: [
          `Olá, ${invitation.name}.`,
          '',
          'Você recebeu um convite para fazer parte de uma equipe no HealthQuest.',
          `Perfil: ${invitation.role}.`,
          `Entre com o e-mail ${invitation.email} e aceite o convite pelo link:`,
          invitationUrl.toString(),
          '',
          `O convite expira em ${invitation.expiresAt.toLocaleString('pt-BR')}.`,
        ].join('\n'),
        html: [
          `<p>Olá, ${this.escapeHtml(invitation.name)}.</p>`,
          '<p>Você recebeu um convite para fazer parte de uma equipe no HealthQuest.</p>',
          `<p>Perfil: ${this.escapeHtml(invitation.role)}.</p>`,
          `<p>Entre com o e-mail <strong>${this.escapeHtml(invitation.email)}</strong> e aceite o convite:</p>`,
          `<p><a href="${this.escapeHtml(invitationUrl.toString())}">Aceitar convite</a></p>`,
          `<p>O convite expira em ${this.escapeHtml(invitation.expiresAt.toLocaleString('pt-BR'))}.</p>`,
        ].join(''),
      });
    } catch (error) {
      this.logger.error('Não foi possível enviar o e-mail de convite.', error);
      throw new ServiceUnavailableException(
        'Não foi possível enviar o convite por e-mail. Verifique a configuração SMTP.',
      );
    }
  }

  private getConfig(): {
    transporter: Transporter;
    from: string;
    invitationAppUrl: URL;
  } {
    if (this.transporter && this.from && this.invitationAppUrl) {
      return {
        transporter: this.transporter,
        from: this.from,
        invitationAppUrl: this.invitationAppUrl,
      };
    }

    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const from = process.env.SMTP_FROM?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;
    const appUrl = process.env.STAFF_INVITATION_APP_URL?.trim();

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from || !appUrl) {
      throw new ServiceUnavailableException(
        'SMTP_HOST, SMTP_PORT, SMTP_FROM e STAFF_INVITATION_APP_URL devem estar configurados.',
      );
    }

    if (Boolean(user) !== Boolean(password)) {
      throw new ServiceUnavailableException(
        'SMTP_USER e SMTP_PASSWORD devem ser configurados em conjunto.',
      );
    }

    let invitationAppUrl: URL;
    try {
      invitationAppUrl = new URL(appUrl);
    } catch {
      throw new ServiceUnavailableException('STAFF_INVITATION_APP_URL deve ser uma URL válida.');
    }

    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(invitationAppUrl.hostname);
    if (invitationAppUrl.protocol !== 'https:' && !(isLocalHost && invitationAppUrl.protocol === 'http:')) {
      throw new ServiceUnavailableException(
        'STAFF_INVITATION_APP_URL deve usar HTTPS, exceto em localhost.',
      );
    }

    const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
    if (secureValue && secureValue !== 'true' && secureValue !== 'false') {
      throw new ServiceUnavailableException('SMTP_SECURE deve ser true ou false.');
    }

    this.from = from;
    this.invitationAppUrl = invitationAppUrl;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: secureValue ? secureValue === 'true' : port === 465,
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });

    return {
      transporter: this.transporter,
      from: this.from,
      invitationAppUrl: this.invitationAppUrl,
    };
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  }
}
