import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
export declare class PrismaTenantPatientsRepository {
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
    findBySupabaseId(id: string, tenantId?: string): Promise<{
        id: string;
        tenantId: string;
        name: string;
        email: string | null;
        phone: string | null;
        document: string | null;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    } | {
        id: string;
        tenantId: string;
        name: string;
        email: string | null;
        phone: string | null;
        document: string | null;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
}
