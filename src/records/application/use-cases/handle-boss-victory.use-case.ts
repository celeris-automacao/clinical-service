import { Inject, Injectable } from '@nestjs/common';
import { ClinicalProgressCalculator } from '../../domain/services/clinical-progress-calculator';
import { BOSS_BATTLE_PORT, RECORDS_ACHIEVEMENTS_PORT } from '../../records.tokens';
import { BossBattlePort } from '../ports/boss-battle.port';
import { RecordsAchievementsPort } from '../ports/records-achievements.port';

@Injectable()
export class HandleBossVictoryUseCase {
  constructor(
    @Inject(BOSS_BATTLE_PORT)
    private readonly bossBattlePort: BossBattlePort,
    @Inject(RECORDS_ACHIEVEMENTS_PORT)
    private readonly recordsAchievementsPort: RecordsAchievementsPort,
    private readonly clinicalProgressCalculator: ClinicalProgressCalculator,
  ) {}

  async execute(bossId: string, tenantId: string, killerId: string) {
    const oldBoss = await this.bossBattlePort.findById(bossId, tenantId);
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

    await this.recordsAchievementsPort.emitBossDefeated({
      tenantId,
      bossId,
      bossName: oldBoss.name,
      killerId,
    });

    await this.recordsAchievementsPort.emitGlobalVictory({
      tenantId,
      message: `VITORIA! O "${nextName}" surgiu!`,
    });
  }
}
