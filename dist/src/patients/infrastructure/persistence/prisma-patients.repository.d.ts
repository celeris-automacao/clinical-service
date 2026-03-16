import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { PatientsRepositoryPort } from '../../application/ports/patients-repository.port';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../../presentation/http/dto/update-patient-profile.dto';
export declare class PrismaPatientsRepository implements PatientsRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    createWithStats(data: CreatePatientDto, tenantId: string): Promise<{
        id: string;
        tenantId: string;
        name: string;
        email: string | null;
        phone: string | null;
        document: string | null;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
    countByTenant(tenantId: string): Promise<any>;
    findBySupabaseId(id: string, tenantId: string): Promise<any>;
    findById(id: string, tenantId: string): Promise<any>;
    updateProfile(patientId: string, tenantId: string, data: UpdatePatientProfileDto): Promise<any>;
}
