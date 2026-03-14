import { Inject, Injectable } from '@nestjs/common';
import { BossBattlePort } from '../ports/boss-battle.port';
import { RecordsAchievementsPort } from '../ports/records-achievements.port';
import { ClinicalProgressCalculator } from '../../domain/services/clinical-progress-calculator';

@Injectable()
export class HandleBossVictoryUseCase {
  constructor(
    @Inject('IBossBattlePort')
    private readonly bossBattlePort: BossBattlePort,
    @Inject('IRecordsAchievementsPort')
    private readonly recordsAchievementsPort: RecordsAchievementsPort,
    private readonly clinicalProgressCalculator: ClinicalProgressCalculator,
  ) {}

  async execute(bossId: string, tenantId: string) {
    const oldBoss = await this.bossBattlePort.findById(bossId);
    if (!oldBoss) {
      return;
    }

    const nextName = this.clinicalProgressCalculator.generateClinicalBossName();
    const nextMaxHp = Math.round(oldBoss.maxHp * 1.15);

    await this.bossBattlePort.handleVictory({
      bossId,
      tenantId,
      nextBossName: nextName,
      nextBossMaxHp: nextMaxHp,
      rewardGold: 5000,
    });

    await this.recordsAchievementsPort.emitGlobalVictory({
      tenantId,
      message: `🏆 VITÓRIA! O "${nextName}" surgiu!`,
    });
  }
}
