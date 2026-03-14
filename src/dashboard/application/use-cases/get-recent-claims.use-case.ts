import { Inject, Injectable } from '@nestjs/common';
import { DASHBOARD_REPOSITORY } from '../../dashboard.tokens';
import { IDashboardRepository } from '../../repositories/interfaces/dashboard.repository.interface';

@Injectable()
export class GetRecentClaimsUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly repository: IDashboardRepository,
  ) {}

  async execute(tenantId: string) {
    return this.repository.findRecentClaims(tenantId, 10);
  }
}
