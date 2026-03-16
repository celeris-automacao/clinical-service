"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const prisma_dashboard_repository_1 = require("../../dashboard/infrastructure/persistence/prisma-dashboard.repository");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
describe('PrismaDashboardRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const prisma = {
        playerStats: {
            count: jest.fn(),
            findMany: jest.fn(),
        },
        socialPost: {
            findMany: jest.fn(),
        },
        rewardClaim: {
            findMany: jest.fn(),
        },
        taskCompletion: {
            findMany: jest.fn(),
        },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_dashboard_repository_1.PrismaDashboardRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forTenant: jest.fn().mockReturnValue(prisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_dashboard_repository_1.PrismaDashboardRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('deve contar jogadores ativos com tenant scope', async () => {
        const since = new Date('2026-01-01');
        await repository.countActivePlayers('tenant-abc', since);
        expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-abc');
        expect(prisma.playerStats.count).toHaveBeenCalledWith({
            where: {
                tenantId: 'tenant-abc',
                lastActivityAt: { gte: since },
            },
        });
    });
    it('deve buscar achievements recentes com tenant scope', async () => {
        await repository.findRecentAchievements('tenant-abc', 5);
        expect(prisma.socialPost.findMany).toHaveBeenCalledWith({
            where: {
                tenantId: 'tenant-abc',
                type: 'achievement',
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                patient: { select: { name: true } },
            },
        });
    });
    it('deve buscar top players com tenant scope', async () => {
        await repository.findTopPlayers('tenant-abc', 3);
        expect(prisma.playerStats.findMany).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-abc' },
            orderBy: { totalDamageDealt: 'desc' },
            take: 3,
            include: {
                patient: { select: { name: true } },
            },
        });
    });
    it('deve buscar historico de task completions com tenant scope', async () => {
        await repository.getTaskCompletionsHistory('tenant-abc');
        expect(prisma.taskCompletion.findMany).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-abc' },
            select: {
                patientId: true,
                completedAt: true,
            },
            orderBy: {
                completedAt: 'desc',
            },
        });
    });
    it('deve buscar recent claims com tenant scope', async () => {
        await repository.findRecentClaims('tenant-abc', 10);
        expect(prisma.rewardClaim.findMany).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-abc' },
            include: { reward: true },
            orderBy: { claimedAt: 'desc' },
            take: 10,
        });
    });
});
//# sourceMappingURL=dashboard.repository.spec.js.map