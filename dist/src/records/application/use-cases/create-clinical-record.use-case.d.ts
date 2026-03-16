import { UserContext } from '../../../shared/auth/user-context';
import { ClinicalProgressCalculator } from '../../domain/services/clinical-progress-calculator';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';
import { BossBattlePort } from '../ports/boss-battle.port';
import { PlayerProgressionPort } from '../ports/player-progression.port';
import { RecordsAchievementsPort } from '../ports/records-achievements.port';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
import { HandleBossVictoryUseCase } from './handle-boss-victory.use-case';
export declare class CreateClinicalRecordUseCase {
    private readonly repository;
    private readonly playerProgressionPort;
    private readonly bossBattlePort;
    private readonly recordsAchievementsPort;
    private readonly clinicalProgressCalculator;
    private readonly handleBossVictoryUseCase;
    constructor(repository: RecordsRepositoryPort, playerProgressionPort: PlayerProgressionPort, bossBattlePort: BossBattlePort, recordsAchievementsPort: RecordsAchievementsPort, clinicalProgressCalculator: ClinicalProgressCalculator, handleBossVictoryUseCase: HandleBossVictoryUseCase);
    execute(dto: CreateRecordDto, user: UserContext): Promise<{
        damage: number;
        message: string;
        id: string;
        tenantId: string;
        patientId: string;
        recordedAt: Date;
        weight: import("@prisma/client/runtime/library").Decimal;
        skeletalMuscleMass: import("@prisma/client/runtime/library").Decimal | null;
        bodyFatMass: import("@prisma/client/runtime/library").Decimal | null;
    }>;
    handleBossVictory(bossId: string, tenantId: string, killerId: string): Promise<void>;
    private calculateAndApplyDamage;
}
