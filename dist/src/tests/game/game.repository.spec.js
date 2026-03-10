"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const game_repository_1 = require("../../game/repositories/game.repository");
const prisma_service_1 = require("../../prisma/prisma.service");
describe('GameRepository', () => {
    let repository;
    let prisma;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                game_repository_1.GameRepository,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        playerStats: { findUnique: jest.fn() },
                        bossBattle: { findFirst: jest.fn() },
                    },
                },
            ],
        }).compile();
        repository = module.get(game_repository_1.GameRepository);
        prisma = module.get(prisma_service_1.PrismaService);
    });
    it('findPlayerProgress deve buscar pelo patientId único', async () => {
        await repository.findPlayerProgress('u1');
        expect(prisma.playerStats.findUnique).toHaveBeenCalledWith({
            where: { patientId: 'u1' },
        });
    });
    it('findActiveBoss deve buscar apenas o Boss ativo da clínica', async () => {
        await repository.findActiveBoss('tenant-1');
        expect(prisma.bossBattle.findFirst).toHaveBeenCalledWith({
            where: { tenantId: 'tenant-1', isActive: true },
        });
    });
});
//# sourceMappingURL=game.repository.spec.js.map