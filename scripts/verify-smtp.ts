import 'dotenv/config';
import { SmtpEmailSenderAdapter } from '../src/email/infrastructure/smtp-email-sender.adapter';

async function verifySmtp() {
  try {
    await new SmtpEmailSenderAdapter().verifyConnection();
    console.log('Conexão SMTP validada com sucesso.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Falha ao validar SMTP.');
    process.exitCode = 1;
  }
}

void verifySmtp();
