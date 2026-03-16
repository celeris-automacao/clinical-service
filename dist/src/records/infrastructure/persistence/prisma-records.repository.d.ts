import { ClinicalRecord } from '@prisma/client';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { RecordsRepositoryPort } from '../../application/ports/records-repository.port';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';
export declare class PrismaRecordsRepository implements RecordsRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    create(data: CreateRecordDto, userId: string, tenantId: string): Promise<ClinicalRecord>;
    findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
    findLastTwo(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
    getClinicalDamageByTenant(tenantId: string): Promise<Map<string, number>>;
}
