"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const prisma_achievements_repository_1 = require("../../achievements/infrastructure/persistence/prisma-achievements.repository");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
describe('PrismaAchievementsRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const rootPrisma = {
        rewardClaim: { findFirst: jest.fn() },
    };
    const tenantPrisma = {
        reward: { upsert: jest.fn() },
        rewardClaim: { create: jest.fn() },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_achievements_repository_1.PrismaAchievementsRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forRoot: jest.fn().mockReturnValue(rootPrisma),
                        forTenant: jest.fn().mockReturnValue(tenantPrisma),
                        forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_achievements_repository_1.PrismaAchievementsRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('getOrCreateBadge deve usar upsert com a chave composta', async () => {
        await repository.getOrCreateBadge('t1', 'Badge Teste', 'icon-1');
        expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('t1');
        expect(tenantPrisma.reward.upsert).toHaveBeenCalledWith({
            where: { title_tenantId: { title: 'Badge Teste', tenantId: 't1' } },
            update: {},
            create: expect.objectContaining({ title: 'Badge Teste', tenantId: 't1' }),
        });
    });
    it('createClaim deve salvar o registro de ganho da medalha', async () => {
        await repository.createClaim('p1', 't1', 'r1');
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'p1',
            tenantId: 't1',
        });
        expect(tenantPrisma.rewardClaim.create).toHaveBeenCalledWith({
            data: { rewardId: 'r1', patientId: 'p1', tenantId: 't1' },
        });
    });
});
//# sourceMappingURL=achievements.repository.spec.js.map