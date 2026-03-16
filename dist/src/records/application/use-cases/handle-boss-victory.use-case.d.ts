import { ClinicalProgressCalculator } from '../../domain/services/clinical-progress-calculator';
import { BossBattlePort } from '../ports/boss-battle.port';
import { RecordsAchievementsPort } from '../ports/records-achievements.port';
export declare class HandleBossVictoryUseCase {
    private readonly bossBattlePort;
    private readonly recordsAchievementsPort;
    private readonly clinicalProgressCalculator;
    constructor(bossBattlePort: BossBattlePort, recordsAchievementsPort: RecordsAchievementsPort, clinicalProgressCalculator: ClinicalProgressCalculator);
    execute(bossId: string, tenantId: string, killerId: string): Promise<void>;
}
