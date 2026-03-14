import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../common/decorators/get-user.decorator';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';
import { ClinicalProgressCalculator } from '../../domain/services/clinical-progress-calculator';
import { IRecordsRepository } from '../ports/records-repository.port';
import {
  BOSS_BATTLE_PORT,
  PLAYER_PROGRESSION_PORT,
  RECORDS_ACHIEVEMENTS_PORT,
  RECORDS_REPOSITORY,
} from '../../records.tokens';
import { BossBattlePort } from '../ports/boss-battle.port';
import { PlayerProgressionPort } from '../ports/player-progression.port';
import { RecordsAchievementsPort } from '../ports/records-achievements.port';
import { HandleBossVictoryUseCase } from './handle-boss-victory.use-case';

@Injectable()
export class CreateClinicalRecordUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: IRecordsRepository,
    @Inject(PLAYER_PROGRESSION_PORT)
    private readonly playerProgressionPort: PlayerProgressionPort,
    @Inject(BOSS_BATTLE_PORT)
    private readonly bossBattlePort: BossBattlePort,
    @Inject(RECORDS_ACHIEVEMENTS_PORT)
    private readonly recordsAchievementsPort: RecordsAchievementsPort,
    private readonly clinicalProgressCalculator: ClinicalProgressCalculator,
    private readonly handleBossVictoryUseCase: HandleBossVictoryUseCase,
  ) {}

  async execute(dto: CreateRecordDto, user: UserContext) {
    const newRecord = await this.repository.create(dto, user.userId, user.tenantId);
    const damageDealt = await this.calculateAndApplyDamage(user.userId, user.tenantId);

    await this.playerProgressionPort.upsertClinicalProgress({
      patientId: user.userId,
      tenantId: user.tenantId,
      damageDealt,
    });

    const history = await this.repository.findAllByPatient(user.userId, user.tenantId);
    const stats = this.clinicalProgressCalculator.calculateStats(history);

    await this.recordsAchievementsPort.checkLevelAchievements({
      patientId: user.userId,
      tenantId: user.tenantId,
      newLevel: stats.currentLevel,
    });

    return {
      ...newRecord,
      damage: damageDealt,
      message:
        damageDealt > 0
          ? `🔥 ATAQUE CRÍTICO! Você causou ${damageDealt.toLocaleString()} de dano no Boss!`
          : 'Registro salvo. Continue focado na sua evolução!',
    };
  }

  async handleBossVictory(bossId: string, tenantId: string) {
    return this.handleBossVictoryUseCase.execute(bossId, tenantId);
  }

  private async calculateAndApplyDamage(userId: string, tenantId: string): Promise<number> {
    const records = await this.repository.findLastTwo(userId);
    const totalDamage = this.clinicalProgressCalculator.calculateDamageFromLatestRecords(records);

    if (totalDamage <= 0) {
      return 0;
    }

    const boss = await this.bossBattlePort.findActiveBoss(tenantId);

    if (!boss) {
      return totalDamage;
    }

    const newHp = boss.currentHp - totalDamage;

    if (newHp <= 0) {
      await this.handleBossVictoryUseCase.execute(boss.id, tenantId);
    } else {
      await this.bossBattlePort.applyDamage(boss.id, newHp);
    }

    return totalDamage;
  }
}
