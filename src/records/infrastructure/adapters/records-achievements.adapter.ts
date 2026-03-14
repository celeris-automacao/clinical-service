import { Injectable } from '@nestjs/common';
import { AchievementsService } from '../../../achievements/achievements.service';
import { RecordsAchievementsPort } from '../../application/ports/records-achievements.port';

@Injectable()
export class RecordsAchievementsAdapter implements RecordsAchievementsPort {
  constructor(private readonly achievementsService: AchievementsService) {}

  async checkLevelAchievements(input: {
    patientId: string;
    tenantId: string;
    newLevel: number;
  }): Promise<void> {
    await this.achievementsService.checkLevelAchievements(
      input.patientId,
      input.tenantId,
      input.newLevel,
    );
  }

  async emitGlobalVictory(input: { tenantId: string; message: string }): Promise<void> {
    await this.achievementsService.emitGlobalVictory(input.tenantId, input.message);
  }
}
