"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
const prisma_tenant_patients_repository_1 = require("../../tenants/infrastructure/persistence/prisma-tenant-patients.repository");
describe('PrismaTenantPatientsRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const rootPrisma = {
        patient: {
            findFirst: jest.fn(),
        },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_tenant_patients_repository_1.PrismaTenantPatientsRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forRoot: jest.fn().mockReturnValue(rootPrisma),
                        forTenant: jest.fn().mockReturnValue(rootPrisma),
                        runInTenantTransaction: jest.fn(),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_tenant_patients_repository_1.PrismaTenantPatientsRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve criar o paciente e os atributos iniciais dentro de uma transacao', async () => {
        const dto = {
            supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            name: 'Paciente Teste',
        };
        const tenantId = 'tenant-1';
        const createdPatient = { id: dto.supabaseId, name: dto.name, tenantId };
        const tx = {
            patient: {
                create: jest.fn().mockResolvedValue(createdPatient),
            },
            playerStats: {
                create: jest.fn().mockResolvedValue({}),
            },
        };
        tenantScopedPrismaFactory.runInTenantTransaction.mockImplementation(async (_context, callback) => callback(tx));
        const result = await repository.createWithStats(dto, tenantId);
        expect(tenantScopedPrismaFactory.runInTenantTransaction).toHaveBeenCalled();
        expect(tx.patient.create).toHaveBeenCalledWith({
            data: {
                id: dto.supabaseId,
                name: dto.name,
                tenantId,
            },
        });
        expect(tx.playerStats.create).toHaveBeenCalledWith({
            data: {
                patientId: createdPatient.id,
                tenantId,
                currentLevel: 1,
                currentXp: 0,
                currentGold: 0,
                totalDamageDealt: 0,
            },
        });
        expect(result).toEqual(createdPatient);
    });
    it('deve buscar um paciente pelo supabaseId', async () => {
        await repository.findBySupabaseId('patient-1');
        expect(rootPrisma.patient.findFirst).toHaveBeenCalledWith({
            where: { id: 'patient-1' },
        });
    });
});
//# sourceMappingURL=patients.repository.spec.js.map