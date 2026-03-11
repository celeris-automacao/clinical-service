import { PrismaService } from '../../prisma/prisma.service';
import { IPatientsRepository } from './interfaces/patients-repository.interface';
import { CreatePatientDto } from '../dto/create-patient.dto';
export declare class PatientsRepository implements IPatientsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createWithStats(data: CreatePatientDto, tenantId: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
    findBySupabaseId(id: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
}
