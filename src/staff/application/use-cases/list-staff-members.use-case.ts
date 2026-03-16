import { Inject, Injectable } from '@nestjs/common';
import { STAFF_REPOSITORY } from '../../staff.tokens';
import { ListStaffMembersDto } from '../../presentation/http/dto/list-staff-members.dto';
import { StaffRepositoryPort } from '../ports/staff-repository.port';

@Injectable()
export class ListStaffMembersUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY)
    private readonly repository: StaffRepositoryPort,
  ) {}

  async execute(tenantId: string, filters: ListStaffMembersDto) {
    return this.repository.findAllByTenant(tenantId, filters);
  }
}
