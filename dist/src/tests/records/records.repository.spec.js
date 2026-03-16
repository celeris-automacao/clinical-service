"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const prisma_records_repository_1 = require("../../records/infrastructure/persistence/prisma-records.repository");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
describe('PrismaRecordsRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const tenantPrisma = {
        clinicalRecord: {
            create: jest.fn(),
            findMany: jest.fn(),
        },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_records_repository_1.PrismaRecordsRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forTenant: jest.fn().mockReturnValue(tenantPrisma),
                        forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_records_repository_1.PrismaRecordsRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve persistir um novo registro clinico com os campos mapeados corretamente', async () => {
        const dto = { weight: 80.5, skeletalMuscleMass: 35, bodyFatMass: 20 };
        await repository.create(dto, 'user-123', 'tenant-456');
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'user-123',
            tenantId: 'tenant-456',
        });
        expect(tenantPrisma.clinicalRecord.create).toHaveBeenCalledWith({
            data: {
                weight: dto.weight,
                skeletalMuscleMass: dto.skeletalMuscleMass,
                bodyFatMass: dto.bodyFatMass,
                patientId: 'user-123',
                tenantId: 'tenant-456',
            },
        });
    });
    it('deve buscar o historico completo por paciente e tenant', async () => {
        await repository.findAllByPatient('user-123', 'tenant-456');
        expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-456', 'user-123');
        expect(tenantPrisma.clinicalRecord.findMany).toHaveBeenCalledWith({
            where: { patientId: 'user-123', tenantId: 'tenant-456' },
            orderBy: { recordedAt: 'asc' },
        });
    });
    it('deve buscar os 2 registros mais recentes por paciente e tenant', async () => {
        await repository.findLastTwo('user-123', 'tenant-456');
        expect(tenantPrisma.clinicalRecord.findMany).toHaveBeenCalledWith({
            where: { patientId: 'user-123', tenantId: 'tenant-456' },
            orderBy: { recordedAt: 'desc' },
            take: 2,
        });
    });
    it('deve calcular o dano acumulado de todos os pacientes da clinica', async () => {
        jest.spyOn(tenantPrisma.clinicalRecord, 'findMany').mockResolvedValue([
            { patientId: 'p1', weight: 100, recordedAt: new Date('2023-01-01') },
            { patientId: 'p1', weight: 95, recordedAt: new Date('2023-01-02') },
            { patientId: 'p2', weight: 80, recordedAt: new Date('2023-01-01') },
            { patientId: 'p2', weight: 82, recordedAt: new Date('2023-01-02') },
            { patientId: 'p2', weight: 79, recordedAt: new Date('2023-01-03') },
        ]);
        const result = await repository.getClinicalDamageByTenant('tenant-123');
        expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-123');
        expect(tenantPrisma.clinicalRecord.findMany).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-123' },
            select: { patientId: true, weight: true, recordedAt: true },
            orderBy: { recordedAt: 'asc' },
        });
        expect(result.get('p1')).toBe(38500);
        expect(result.get('p2')).toBe(23100);
    });
});
//# sourceMappingURL=records.repository.spec.js.map