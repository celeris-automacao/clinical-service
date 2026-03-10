"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const game_service_1 = require("../../game/game.service");
const records_service_1 = require("../../records/records.service");
describe('GameService', () => {
    let service;
    let repository;
    let recordsService;
    const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                game_service_1.GameService,
                {
                    provide: 'IGameRepository',
                    useValue: {
                        findPlayerProgress: jest.fn(),
                        findActiveBoss: jest.fn(),
                    },
                },
                {
                    provide: records_service_1.RecordsService,
                    useValue: { getStats: jest.fn() },
                },
            ],
        }).compile();
        service = module.get(game_service_1.GameService);
        repository = module.get('IGameRepository');
        recordsService = module.get(records_service_1.RecordsService);
    });
    describe('getPlayerStats', () => {
        it('deve consolidar nível, XP e status do Boss com precisão', async () => {
            recordsService.getStats.mockResolvedValue({ totalDamage: 5000 });
            repository.findPlayerProgress.mockResolvedValue({
                currentLevel: 5,
                currentXp: 450,
            });
            repository.findActiveBoss.mockResolvedValue({
                name: 'Dragão de Açúcar',
                currentHp: { toNumber: () => 500 },
                maxHp: { toNumber: () => 1000 },
            });
            const stats = await service.getPlayerStats(mockUser);
            expect(stats.level).toBe(5);
            expect(stats.nextLevelXp).toBe(5000);
            expect(stats.totalDamageDealt).toBe(5000);
            expect(stats.boss).toEqual({
                name: 'Dragão de Açúcar',
                hpPercentage: 50,
                currentHp: 500,
            });
        });
        it('deve retornar valores iniciais seguros se o jogador não tiver dados', async () => {
            recordsService.getStats.mockResolvedValue({ totalDamage: 0 });
            repository.findPlayerProgress.mockResolvedValue(null);
            repository.findActiveBoss.mockResolvedValue(null);
            const stats = await service.getPlayerStats(mockUser);
            expect(stats.level).toBe(1);
            expect(stats.currentXp).toBe(0);
            expect(stats.boss).toBeNull();
        });
    });
});
//# sourceMappingURL=game.service.spec.js.map