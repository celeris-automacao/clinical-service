"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const prisma_game_repository_1 = require("../../game/infrastructure/persistence/prisma-game.repository");
const tenant_scoped_prisma_factory_1 = require("../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
describe('PrismaGameRepository', () => {
    let repository;
    let tenantScopedPrismaFactory;
    const tenantPrisma = {
        playerStats: { findFirst: jest.fn() },
        bossBattle: { findFirst: jest.fn() },
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                prisma_game_repository_1.PrismaGameRepository,
                {
                    provide: tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
                    useValue: {
                        forTenant: jest.fn().mockReturnValue(tenantPrisma),
                        forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
                    },
                },
            ],
        }).compile();
        repository = module.get(prisma_game_repository_1.PrismaGameRepository);
        tenantScopedPrismaFactory = module.get(tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory);
    });
    it('findPlayerProgress deve buscar pelo patientId dentro do tenant', async () => {
        await repository.findPlayerProgress('u1', 't1');
        expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
            userId: 'u1',
            tenantId: 't1',
        });
        expect(tenantPrisma.playerStats.findFirst).toHaveBeenCalledWith({
            where: { patientId: 'u1', tenantId: 't1' },
        });
    });
    it('findActiveBoss deve buscar apenas o boss ativo da clinica', async () => {
        await repository.findActiveBoss('tenant-1');
        expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-1');
        expect(tenantPrisma.bossBattle.findFirst).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-1', isActive: true },
        });
    });
});
//# sourceMappingURL=game.repository.spec.js.map