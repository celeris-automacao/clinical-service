import { Inject, Injectable } from '@nestjs/common';
import { STAFF_REPOSITORY } from '../../staff.tokens';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class CleanupExpiredStaffInvitationsUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
  ) {}

  async execute(referenceDate: Date = new Date()) {
    return this.repository.cleanupExpiredInvitations(referenceDate);
  }
}
