import { Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { GetPatientStatsUseCase } from '../../../records/application/use-cases/get-patient-stats.use-case';
import { RewardsStatsPort } from '../../application/ports/rewards-stats.port';

@Injectable()
export class RecordsRewardsStatsAdapter implements RewardsStatsPort {
  constructor(private readonly getPatientStatsUseCase: GetPatientStatsUseCase) {}

  async getStats(user: UserContext): Promise<{ totalDamage: number }> {
    return this.getPatientStatsUseCase.execute(user);
  }
}
