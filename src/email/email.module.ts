import { Module } from '@nestjs/common';
import { EMAIL_SENDER } from './email.tokens';
import { SmtpEmailSenderAdapter } from './infrastructure/smtp-email-sender.adapter';

@Module({
  providers: [
    SmtpEmailSenderAdapter,
    {
      provide: EMAIL_SENDER,
      useExisting: SmtpEmailSenderAdapter,
    },
  ],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
