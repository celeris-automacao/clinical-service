import { PrismaService } from '../prisma/prisma.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UserContext } from '../common/decorators/get-user.decorator';
import { Prisma } from '@prisma/client';
import { AchievementsService } from '../game/achievements.service';
export declare class RecordsService {
    private prisma;
    private readonly achievementsService;
    constructor(prisma: PrismaService, achievementsService: AchievementsService);
    create(dto: CreateRecordDto, user: UserContext): Promise<{
        id: string;
        message: string;
        damage: number;
    }>;
    private calculateAndApplyDamage;
    getEvolution(user: UserContext): Promise<{
        recordedAt: Date;
        weight: number;
        skeletalMuscleMass: number;
        bodyFatMass: number;
    }[]>;
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
    private calculateRank;
    calculateLevel(totalDamage: number): number;
    calculateProgressToNextLevel(totalDamage: number): {
        currentLevel: number;
        progressPercentage: number;
        nextLevelThreshold: number;
    };
    createRecord(data: CreateRecordDto, user: UserContext): Promise<{
        id: string;
        tenantId: string;
        weight: Prisma.Decimal;
        patientId: string;
        recordedAt: Date;
        skeletalMuscleMass: Prisma.Decimal | null;
        bodyFatMass: Prisma.Decimal | null;
    }>;
}
