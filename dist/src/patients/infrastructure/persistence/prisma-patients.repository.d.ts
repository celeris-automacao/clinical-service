import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PatientsRepositoryPort } from '../../application/ports/patients-repository.port';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../../presentation/http/dto/update-patient-profile.dto';
export declare class PrismaPatientsRepository implements PatientsRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    createWithStats(data: CreatePatientDto, tenantId: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
    findBySupabaseId(id: string, tenantId: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
    findById(id: string, tenantId: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
    updateProfile(patientId: string, tenantId: string, data: UpdatePatientProfileDto): Promise<{
        patientId: string;
        initialGoals: string | null;
        symptoms: string | null;
        pathologies: string | null;
        medicalNotes: string | null;
    }>;
}
