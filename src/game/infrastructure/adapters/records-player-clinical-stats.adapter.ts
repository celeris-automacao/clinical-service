import { Injectable } from '@nestjs/common';
import { UserContext } from '../../../common/decorators/get-user.decorator';
import { GetPatientStatsUseCase } from '../../../records/application/use-cases/get-patient-stats.use-case';
import { PlayerClinicalStatsPort } from '../../application/ports/player-clinical-stats.port';

@Injectable()
export class RecordsPlayerClinicalStatsAdapter implements PlayerClinicalStatsPort {
  constructor(private readonly getPatientStatsUseCase: GetPatientStatsUseCase) {}

  async getStats(user: UserContext): Promise<{ totalDamage: number }> {
    return this.getPatientStatsUseCase.execute(user);
  }
}
