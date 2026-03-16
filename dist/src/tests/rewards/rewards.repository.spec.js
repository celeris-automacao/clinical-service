"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const prisma_rewards_repository_1 = require("../../rewards/infrastructure/persistence/prisma-rewards.repository");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
describe('PrismaRewardsRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const tenantPrisma = {
        reward: { findMany: jest.fn(), findFirst: jest.fn() },
        rewardClaim: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_rewards_repository_1.PrismaRewardsRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forTenant: jest.fn().mockReturnValue(tenantPrisma),
                        forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_rewards_repository_1.PrismaRewardsRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve buscar claims do paciente dentro do tenant', async () => {
        await repository.findClaimsByPatient('u1', 't1');
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'u1',
            tenantId: 't1',
        });
        expect(tenantPrisma.rewardClaim.findMany).toHaveBeenCalledWith({
            where: { patientId: 'u1', tenantId: 't1' },
        });
    });
    it('deve filtrar recompensas ativas por tenant', async () => {
        await repository.findAllActiveByTenant('tenant-123');
        expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-123');
        expect(tenantPrisma.reward.findMany).toHaveBeenCalledWith({
            where: { isActive: true, tenantId: 'tenant-123' },
        });
    });
    it('deve buscar recompensa por id dentro do tenant', async () => {
        await repository.findById('r1', 't1');
        expect(tenantPrisma.reward.findFirst).toHaveBeenCalledWith({
            where: { id: 'r1', tenantId: 't1' },
        });
    });
    it('deve buscar claim especifica dentro do tenant', async () => {
        await repository.findSpecificClaim('r1', 'u1', 't1');
        expect(tenantPrisma.rewardClaim.findFirst).toHaveBeenCalledWith({
            where: { rewardId: 'r1', patientId: 'u1', tenantId: 't1' },
        });
    });
    it('deve criar claim com tenant-scoped prisma', async () => {
        const data = { rewardId: 'r1', patientId: 'u1', tenantId: 't1' };
        await repository.createClaim(data);
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'u1',
            tenantId: 't1',
        });
        expect(tenantPrisma.rewardClaim.create).toHaveBeenCalledWith({ data });
    });
});
//# sourceMappingURL=rewards.repository.spec.js.map