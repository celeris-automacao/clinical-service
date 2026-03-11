import { CreateRecordDto } from './dto/create-record.dto';
import { UserContext } from '../common/decorators/get-user.decorator';
import { AchievementsService } from '../achievements/achievements.service';
import { IRecordsRepository } from './repositories/interfaces/records.repository.interface';
import { PrismaService } from '../prisma/prisma.service';
export declare class RecordsService {
    private readonly repository;
    private readonly prisma;
    private readonly achievementsService;
    constructor(repository: IRecordsRepository, prisma: PrismaService, achievementsService: AchievementsService);
    createRecord(dto: CreateRecordDto, user: UserContext): Promise<{
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
    private calculateAndApplyDamage;
    getStats(user: UserContext): Promise<{
        recordsCount: number;
        rank: string;
        currentLevel: number;
        progressPercentage: number;
        nextLevelThreshold: number;
        patientId: string;
        totalDamage: number;
        totalWeightLoss: number;
    }>;
    getEvolution(user: UserContext): Promise<{
        recordedAt: Date;
        weight: number;
        skeletalMuscleMass: number;
        bodyFatMass: number;
    }[]>;
    private calculateRank;
    private calculateLevel;
    private calculateProgressToNextLevel;
    handleBossVictory(bossId: string, tenantId: string): Promise<void>;
    private generateClinicalBossName;
}
