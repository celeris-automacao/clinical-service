"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const get_player_stats_use_case_1 = require("../../game/application/use-cases/get-player-stats.use-case");
const game_tokens_1 = require("../../game/game.tokens");
describe('GetPlayerStatsUseCase', () => {
    let useCase;
    let repository;
    let playerClinicalStatsPort;
    const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                get_player_stats_use_case_1.GetPlayerStatsUseCase,
                {
                    provide: game_tokens_1.GAME_REPOSITORY,
                    useValue: {
                        findPlayerProgress: jest.fn(),
                        findActiveBoss: jest.fn(),
                    },
                },
                {
                    provide: game_tokens_1.PLAYER_CLINICAL_STATS_PORT,
                    useValue: { getStats: jest.fn() },
                },
            ],
        }).compile();
        useCase = module.get(get_player_stats_use_case_1.GetPlayerStatsUseCase);
        repository = module.get(game_tokens_1.GAME_REPOSITORY);
        playerClinicalStatsPort = module.get(game_tokens_1.PLAYER_CLINICAL_STATS_PORT);
    });
    it('deve consolidar nivel, XP e status do boss com precisao', async () => {
        playerClinicalStatsPort.getStats.mockResolvedValue({ totalDamage: 5000 });
        repository.findPlayerProgress.mockResolvedValue({
            currentLevel: 5,
            currentXp: 450,
        });
        repository.findActiveBoss.mockResolvedValue({
            name: 'Dragao de Acucar',
            currentHp: { toNumber: () => 500 },
            maxHp: { toNumber: () => 1000 },
        });
        const stats = await useCase.execute(mockUser);
        expect(repository.findPlayerProgress).toHaveBeenCalledWith('u1', 't1');
        expect(stats.level).toBe(5);
        expect(stats.nextLevelXp).toBe(5000);
        expect(stats.totalDamageDealt).toBe(5000);
        expect(stats.boss).toEqual({
            name: 'Dragao de Acucar',
            hpPercentage: 50,
            currentHp: 500,
        });
    });
    it('deve retornar valores iniciais seguros se o jogador nao tiver dados', async () => {
        playerClinicalStatsPort.getStats.mockResolvedValue({ totalDamage: 0 });
        repository.findPlayerProgress.mockResolvedValue(null);
        repository.findActiveBoss.mockResolvedValue(null);
        const stats = await useCase.execute(mockUser);
        expect(repository.findPlayerProgress).toHaveBeenCalledWith('u1', 't1');
        expect(stats.level).toBe(1);
        expect(stats.currentXp).toBe(0);
        expect(stats.boss).toBeNull();
    });
});
//# sourceMappingURL=get-player-stats.use-case.spec.js.map