import * as nodemailer from 'nodemailer';
import { ServiceUnavailableException } from '@nestjs/common';
import { SmtpEmailSenderAdapter } from '../../email/infrastructure/smtp-email-sender.adapter';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('SmtpEmailSenderAdapter', () => {
  const envKeys = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'STAFF_INVITATION_APP_URL',
  ] as const;
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );
  const createTransport = nodemailer.createTransport as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASSWORD = 'smtp-password';
    process.env.SMTP_FROM = 'HealthQuest <noreply@example.test>';
    process.env.STAFF_INVITATION_APP_URL = 'https://app.example.test/';
  });

  afterAll(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('envia link de convite no fragmento e escapa conteúdo HTML', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const verify = jest.fn().mockResolvedValue(true);
    createTransport.mockReturnValue({ sendMail, verify });

    const sender = new SmtpEmailSenderAdapter();
    await sender.sendStaffInvitation({
      email: 'ana@example.test',
      name: '<Ana>',
      role: 'doctor',
      token: 'token-123',
      expiresAt: new Date('2026-10-22T00:00:00.000Z'),
    });

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-password' },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@example.test',
        html: expect.stringContaining(
          'href="https://app.example.test/#invite/token-123"',
        ),
      }),
    );
    expect(sendMail.mock.calls[0][0].html).toContain('&lt;Ana&gt;');
  });

  it('falha explicitamente quando a configuração SMTP obrigatória está ausente', async () => {
    delete process.env.SMTP_HOST;

    await expect(
      new SmtpEmailSenderAdapter().sendStaffInvitation({
        email: 'ana@example.test',
        name: 'Ana',
        role: 'doctor',
        token: 'token-123',
        expiresAt: new Date('2026-10-22T00:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
