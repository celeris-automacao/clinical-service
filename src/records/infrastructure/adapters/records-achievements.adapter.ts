import { Injectable } from '@nestjs/common';
import { CheckLevelAchievementsUseCase } from '../../../achievements/application/use-cases/check-level-achievements.use-case';
import { EmitGlobalVictoryUseCase } from '../../../achievements/application/use-cases/emit-global-victory.use-case';
import { RecordsAchievementsPort } from '../../application/ports/records-achievements.port';

@Injectable()
export class RecordsAchievementsAdapter implements RecordsAchievementsPort {
  constructor(
    private readonly checkLevelAchievementsUseCase: CheckLevelAchievementsUseCase,
    private readonly emitGlobalVictoryUseCase: EmitGlobalVictoryUseCase,
  ) {}

  async checkLevelAchievements(input: {
    patientId: string;
    tenantId: string;
    newLevel: number;
  }): Promise<void> {
    await this.checkLevelAchievementsUseCase.execute(input);
  }

  async emitGlobalVictory(input: { tenantId: string; message: string }): Promise<void> {
    await this.emitGlobalVictoryUseCase.execute(input);
  }
}
