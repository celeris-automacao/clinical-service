import { CheckLevelAchievementsUseCase } from '../../../achievements/application/use-cases/check-level-achievements.use-case';
import { EmitBossDefeatedUseCase } from '../../../achievements/application/use-cases/emit-boss-defeated.use-case';
import { EmitGlobalVictoryUseCase } from '../../../achievements/application/use-cases/emit-global-victory.use-case';
import { RecordsAchievementsPort } from '../../application/ports/records-achievements.port';
export declare class RecordsAchievementsAdapter implements RecordsAchievementsPort {
    private readonly checkLevelAchievementsUseCase;
    private readonly emitBossDefeatedUseCase;
    private readonly emitGlobalVictoryUseCase;
    constructor(checkLevelAchievementsUseCase: CheckLevelAchievementsUseCase, emitBossDefeatedUseCase: EmitBossDefeatedUseCase, emitGlobalVictoryUseCase: EmitGlobalVictoryUseCase);
    checkLevelAchievements(input: {
        patientId: string;
        tenantId: string;
        newLevel: number;
    }): Promise<void>;
    emitBossDefeated(input: {
        tenantId: string;
        bossId: string;
        bossName: string;
        killerId: string;
    }): Promise<void>;
    emitGlobalVictory(input: {
        tenantId: string;
        message: string;
    }): Promise<void>;
}
