"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
const prisma_tenants_repository_1 = require("../../tenants/infrastructure/persistence/prisma-tenants.repository");
describe('PrismaTenantsRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const rootPrisma = {
        tenant: {
            create: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
        },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_tenants_repository_1.PrismaTenantsRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forRoot: jest.fn().mockReturnValue(rootPrisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_tenants_repository_1.PrismaTenantsRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve criar o tenant junto com o boss inicial', async () => {
        const dto = { name: 'Clinica Vida' };
        await repository.create(dto);
        expect(tenantScopedPrismaFactory.forRoot).toHaveBeenCalled();
        expect(rootPrisma.tenant.create).toHaveBeenCalledWith({
            data: {
                name: dto.name,
                bossBattles: {
                    create: {
                        name: 'Sedentarismo Voraz',
                        maxHp: 100000,
                        currentHp: 100000,
                        isActive: true,
                    },
                },
            },
        });
    });
    it('deve buscar um tenant por id', async () => {
        await repository.findById('tenant-1');
        expect(rootPrisma.tenant.findUnique).toHaveBeenCalledWith({
            where: { id: 'tenant-1' },
        });
    });
    it('deve listar os tenants incluindo a contagem de pacientes', async () => {
        await repository.findAll();
        expect(rootPrisma.tenant.findMany).toHaveBeenCalledWith({
            include: {
                _count: {
                    select: { patients: true },
                },
            },
        });
    });
});
//# sourceMappingURL=tenants.repository.spec.js.map