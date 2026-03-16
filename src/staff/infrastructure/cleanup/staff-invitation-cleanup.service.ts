import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CleanupExpiredStaffInvitationsUseCase } from '../../application/use-cases/cleanup-expired-staff-invitations.use-case';

@Injectable()
export class StaffInvitationCleanupService implements OnModuleInit, OnModuleDestroy {
  private intervalRef?: NodeJS.Timeout;

  constructor(
    private readonly cleanupExpiredStaffInvitationsUseCase: CleanupExpiredStaffInvitationsUseCase,
  ) {}

  onModuleInit() {
    this.intervalRef = setInterval(() => {
      void this.cleanupExpiredStaffInvitationsUseCase.execute();
    }, 1000 * 60 * 60);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }
}
