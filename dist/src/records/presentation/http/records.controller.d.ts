import { UserContext } from '../../../shared/auth/user-context';
import { CreateClinicalRecordUseCase } from '../../application/use-cases/create-clinical-record.use-case';
import { GetPatientEvolutionUseCase } from '../../application/use-cases/get-patient-evolution.use-case';
import { GetPatientStatsUseCase } from '../../application/use-cases/get-patient-stats.use-case';
import { CreateRecordDto } from './dto/create-record.dto';
export declare class RecordsController {
    private readonly createClinicalRecordUseCase;
    private readonly getPatientEvolutionUseCase;
    private readonly getPatientStatsUseCase;
    constructor(createClinicalRecordUseCase: CreateClinicalRecordUseCase, getPatientEvolutionUseCase: GetPatientEvolutionUseCase, getPatientStatsUseCase: GetPatientStatsUseCase);
    createRecord(createRecordDto: CreateRecordDto, user: UserContext): Promise<{
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
    getEvolution(user: UserContext): Promise<{
        recordedAt: Date;
        weight: number;
        skeletalMuscleMass: number;
        bodyFatMass: number;
    }[]>;
    getStats(user: UserContext): Promise<{
        rank: string;
        currentLevel: number;
        progressPercentage: number;
        nextLevelThreshold: number;
        totalDamage: number;
        totalWeightLoss: number;
        patientId: string;
        recordsCount: number;
    }>;
}
