import { PrismaService } from '../../prisma/prisma.service';
import { IPatientsRepository } from './interfaces/patients-repository.interface';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../dto/update-patient-profile.dto';
export declare class PatientsRepository implements IPatientsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createWithStats(data: CreatePatientDto, tenantId: string): Promise<{
        id: string;
        name: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
        tenantId: string;
    }>;
    findBySupabaseId(id: string): Promise<{
        id: string;
        name: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
        tenantId: string;
    }>;
    findById(id: string): Promise<{
        id: string;
        name: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
        tenantId: string;
    }>;
    updateProfile(patientId: string, data: UpdatePatientProfileDto): Promise<{
        patientId: string;
        initialGoals: string | null;
        symptoms: string | null;
        pathologies: string | null;
        medicalNotes: string | null;
    }>;
}
