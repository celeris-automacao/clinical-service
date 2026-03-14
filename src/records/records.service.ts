import { Injectable } from '@nestjs/common';
import { CreateRecordDto } from './dto/create-record.dto';
import { UserContext } from '../common/decorators/get-user.decorator';
import { CreateClinicalRecordUseCase } from './application/use-cases/create-clinical-record.use-case';
import { GetPatientStatsUseCase } from './application/use-cases/get-patient-stats.use-case';
import { GetPatientEvolutionUseCase } from './application/use-cases/get-patient-evolution.use-case';
import { HandleBossVictoryUseCase } from './application/use-cases/handle-boss-victory.use-case';

@Injectable()
export class RecordsService {
  constructor(
    private readonly createClinicalRecordUseCase: CreateClinicalRecordUseCase,
    private readonly getPatientStatsUseCase: GetPatientStatsUseCase,
    private readonly getPatientEvolutionUseCase: GetPatientEvolutionUseCase,
    private readonly handleBossVictoryUseCase: HandleBossVictoryUseCase,
  ) {}

  async createRecord(dto: CreateRecordDto, user: UserContext) {
    return this.createClinicalRecordUseCase.execute(dto, user);
  }

  async getStats(user: UserContext) {
    return this.getPatientStatsUseCase.execute(user);
  }

  async getEvolution(user: UserContext) {
    return this.getPatientEvolutionUseCase.execute(user);
  }

  async handleBossVictory(bossId: string, tenantId: string) {
    return this.handleBossVictoryUseCase.execute(bossId, tenantId);
  }
}
