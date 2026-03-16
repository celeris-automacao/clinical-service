import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STAFF_REPOSITORY } from '../../staff.tokens';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class GetStaffMemberByIdUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
  ) {}

  async execute(id: string, tenantId: string) {
    const staffMember = await this.repository.findById(id, tenantId);
    if (!staffMember) {
      throw new NotFoundException('Profissional nao encontrado na clinica.');
    }
    return staffMember;
  }
}
