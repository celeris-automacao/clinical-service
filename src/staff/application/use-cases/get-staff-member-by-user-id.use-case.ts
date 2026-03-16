import { Inject, Injectable } from '@nestjs/common';
import { STAFF_REPOSITORY } from '../../staff.tokens';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class GetStaffMemberByUserIdUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
  ) {}

  async execute(userId: string, tenantId: string) {
    return this.repository.findByUserId(userId, tenantId);
  }
}
