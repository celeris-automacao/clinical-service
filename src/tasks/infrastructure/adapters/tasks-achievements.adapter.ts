import { Injectable } from '@nestjs/common';
import { AchievementsService } from '../../../achievements/achievements.service';
import { TasksAchievementsPort } from '../../application/ports/tasks-achievements.port';

@Injectable()
export class TasksAchievementsAdapter implements TasksAchievementsPort {
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
}
