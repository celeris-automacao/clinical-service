import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { DASHBOARD_REPOSITORY } from '../../dashboard.tokens';
import { DashboardRepositoryPort, DashboardQueryParams } from '../ports/dashboard-repository.port';

@Injectable()
export class GetRecentClaimsUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly repository: DashboardRepositoryPort,
  ) {}

  async execute(user: UserContext) {
    const params: DashboardQueryParams = { tenantId: user.tenantId };
    if (user.role !== 'admin' && user.staffId) {
      params.staffId = user.staffId;
    }

    return this.repository.findRecentClaims(params, 10);
  }
}
