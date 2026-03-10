import { RecordsService } from './records.service';
import { CreateRecordDto } from './dto/create-record.dto';
import { UserContext } from '../common/decorators/get-user.decorator';
export declare class RecordsController {
    private readonly recordsService;
    constructor(recordsService: RecordsService);
    createRecord(createRecordDto: CreateRecordDto, user: UserContext): Promise<{
        damage: number;
        message: string;
        id: string;
        tenantId: string;
        weight: import("@prisma/client/runtime/library").Decimal;
        patientId: string;
        recordedAt: Date;
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
        recordsCount: number;
        rank: string;
        currentLevel: number;
        progressPercentage: number;
        nextLevelThreshold: number;
        patientId: string;
        totalDamage: number;
        totalWeightLoss: number;
    }>;
}
