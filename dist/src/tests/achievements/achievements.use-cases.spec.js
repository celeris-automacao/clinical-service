"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const check_level_achievements_use_case_1 = require("../../achievements/application/use-cases/check-level-achievements.use-case");
const emit_global_victory_use_case_1 = require("../../achievements/application/use-cases/emit-global-victory.use-case");
const achievements_tokens_1 = require("../../achievements/achievements.tokens");
describe('Achievements Use Cases', () => {
    let repository;
    let eventsPort;
    let checkLevelAchievementsUseCase;
    let emitGlobalVictoryUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                check_level_achievements_use_case_1.CheckLevelAchievementsUseCase,
                emit_global_victory_use_case_1.EmitGlobalVictoryUseCase,
                {
                    provide: achievements_tokens_1.ACHIEVEMENTS_REPOSITORY,
                    useValue: {
                        getOrCreateBadge: jest.fn(),
                        findClaim: jest.fn(),
                        createClaim: jest.fn(),
                    },
                },
                {
                    provide: achievements_tokens_1.ACHIEVEMENTS_EVENTS_PORT,
                    useValue: {
                        emitAchievementUnlocked: jest.fn().mockResolvedValue(undefined),
                        emitBossDefeatedGlobal: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();
        repository = module.get(achievements_tokens_1.ACHIEVEMENTS_REPOSITORY);
        eventsPort = module.get(achievements_tokens_1.ACHIEVEMENTS_EVENTS_PORT);
        checkLevelAchievementsUseCase = module.get(check_level_achievements_use_case_1.CheckLevelAchievementsUseCase);
        emitGlobalVictoryUseCase = module.get(emit_global_victory_use_case_1.EmitGlobalVictoryUseCase);
    });
    it('não deve fazer nada se o nível não tiver conquista mapeada', async () => {
        await checkLevelAchievementsUseCase.execute({
            patientId: 'p1',
            tenantId: 't1',
            newLevel: 3,
        });
        expect(repository.getOrCreateBadge).not.toHaveBeenCalled();
        expect(eventsPort.emitAchievementUnlocked).not.toHaveBeenCalled();
    });
    it('deve criar uma conquista e emitir evento se for um nível válido e não possuir a medalha', async () => {
        repository.getOrCreateBadge.mockResolvedValue({
            id: 'r2',
            title: 'Medalha de Nível 2',
        });
        repository.findClaim.mockResolvedValue(null);
        await checkLevelAchievementsUseCase.execute({
            patientId: 'p1',
            tenantId: 't1',
            newLevel: 2,
        });
        expect(repository.getOrCreateBadge).toHaveBeenCalledWith('t1', 'Medalha de Nível 2', 'award');
        expect(repository.createClaim).toHaveBeenCalledWith('p1', 't1', 'r2');
        expect(eventsPort.emitAchievementUnlocked).toHaveBeenCalledWith({
            patientId: 'p1',
            tenantId: 't1',
            achievement: 'Medalha de Nível 2',
        });
    });
    it('não deve criar duplicidade se o paciente já possuir a conquista', async () => {
        repository.getOrCreateBadge.mockResolvedValue({
            id: 'r5',
            title: 'Guerreiro de Elite',
        });
        repository.findClaim.mockResolvedValue({ id: 'claim-1' });
        await checkLevelAchievementsUseCase.execute({
            patientId: 'p1',
            tenantId: 't1',
            newLevel: 5,
        });
        expect(repository.createClaim).not.toHaveBeenCalled();
        expect(eventsPort.emitAchievementUnlocked).not.toHaveBeenCalled();
    });
    it('deve emitir vitória global com timestamp', async () => {
        await emitGlobalVictoryUseCase.execute({
            tenantId: 't1',
            message: 'Boss derrotado',
        });
        expect(eventsPort.emitBossDefeatedGlobal).toHaveBeenCalledWith(expect.objectContaining({
            tenantId: 't1',
            message: 'Boss derrotado',
            timestamp: expect.any(Date),
        }));
    });
});
//# sourceMappingURL=achievements.use-cases.spec.js.map