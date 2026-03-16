import { Injectable } from '@nestjs/common';
import { CheckLevelAchievementsUseCase } from '../../../achievements/application/use-cases/check-level-achievements.use-case';
import { TasksAchievementsPort } from '../../application/ports/tasks-achievements.port';

@Injectable()
export class TasksAchievementsAdapter implements TasksAchievementsPort {
  constructor(private readonly checkLevelAchievementsUseCase: CheckLevelAchievementsUseCase) {}

  async checkLevelAchievements(input: {
    patientId: string;
    tenantId: string;
    newLevel: number;
  }): Promise<void> {
    await this.checkLevelAchievementsUseCase.execute(input);
  }
}
