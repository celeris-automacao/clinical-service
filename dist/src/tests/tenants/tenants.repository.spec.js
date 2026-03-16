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
            update: jest.fn(),
        },
        plan: {
            findFirst: jest.fn(),
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
    it('deve criar o tenant junto com plano, endereco e boss inicial', async () => {
        const dto = {
            name: 'Clinica Vida',
            legalName: 'Clinica Vida LTDA',
            cnpj: '12345678000199',
            planId: 'plan-1',
            responsibleName: 'Helena Costa',
            responsibleEmail: 'owner@clinica.com',
            responsiblePhone: '11999999999',
            address: {
                zipCode: '01311000',
                street: 'Av Paulista',
                number: '1000',
                neighborhood: 'Bela Vista',
                city: 'Sao Paulo',
                state: 'SP',
            },
        };
        await repository.create(dto);
        expect(tenantScopedPrismaFactory.forRoot).toHaveBeenCalled();
        expect(rootPrisma.tenant.create).toHaveBeenCalled();
    });
    it('deve buscar um tenant por id incluindo plano e endereco', async () => {
        await repository.findById('tenant-1');
        expect(rootPrisma.tenant.findUnique).toHaveBeenCalledWith({
            where: { id: 'tenant-1' },
            include: {
                plan: true,
                address: true,
            },
        });
    });
    it('deve listar os tenants incluindo plano, endereco e contagens operacionais', async () => {
        await repository.findAll();
        expect(rootPrisma.tenant.findMany).toHaveBeenCalledWith({
            include: {
                plan: true,
                address: true,
                _count: {
                    select: { patients: true, staff: true },
                },
            },
        });
    });
    it('deve buscar plano ativo por id', async () => {
        await repository.findActivePlanById('plan-1');
        expect(rootPrisma.plan.findFirst).toHaveBeenCalledWith({
            where: { id: 'plan-1', isActive: true },
        });
    });
    it('deve alterar o status operacional do tenant', async () => {
        await repository.updateStatus('tenant-1', 'inactive');
        expect(rootPrisma.tenant.update).toHaveBeenCalled();
    });
});
//# sourceMappingURL=tenants.repository.spec.js.map