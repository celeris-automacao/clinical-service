"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const achievements_service_1 = require("../../achievements/achievements.service");
const event_emitter_1 = require("@nestjs/event-emitter");
describe('AchievementsService', () => {
    let service;
    let repository;
    let eventEmitter;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                achievements_service_1.AchievementsService,
                {
                    provide: 'IAchievementsRepository',
                    useValue: {
                        getOrCreateBadge: jest.fn(),
                        findClaim: jest.fn(),
                        createClaim: jest.fn(),
                    },
                },
                {
                    provide: event_emitter_1.EventEmitter2,
                    useValue: { emit: jest.fn() },
                },
            ],
        }).compile();
        service = module.get(achievements_service_1.AchievementsService);
        repository = module.get('IAchievementsRepository');
        eventEmitter = module.get(event_emitter_1.EventEmitter2);
    });
    describe('checkLevelAchievements', () => {
        const patientId = 'p1';
        const tenantId = 't1';
        it('não deve fazer nada se o nível não tiver conquista mapeada', async () => {
            await service.checkLevelAchievements(patientId, tenantId, 3);
            expect(repository.getOrCreateBadge).not.toHaveBeenCalled();
            expect(eventEmitter.emit).not.toHaveBeenCalled();
        });
        it('deve criar uma conquista e emitir evento se for um nível válido e não possuir a medalha', async () => {
            const mockReward = { id: 'r2', title: 'Medalha de Nível 2' };
            repository.getOrCreateBadge.mockResolvedValue(mockReward);
            repository.findClaim.mockResolvedValue(null);
            await service.checkLevelAchievements(patientId, tenantId, 2);
            expect(repository.getOrCreateBadge).toHaveBeenCalledWith(tenantId, 'Medalha de Nível 2', 'award');
            expect(repository.createClaim).toHaveBeenCalledWith(patientId, tenantId, 'r2');
            expect(eventEmitter.emit).toHaveBeenCalledWith('achievement.unlocked', {
                patientId,
                tenantId,
                achievement: 'Medalha de Nível 2'
            });
        });
        it('não deve criar duplicidade se o paciente já possuir a conquista', async () => {
            const mockReward = { id: 'r5', title: 'Guerreiro de Elite' };
            repository.getOrCreateBadge.mockResolvedValue(mockReward);
            repository.findClaim.mockResolvedValue({ id: 'claim1' });
            await service.checkLevelAchievements(patientId, tenantId, 5);
            expect(repository.createClaim).not.toHaveBeenCalled();
            expect(eventEmitter.emit).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=achievements.service.spec.js.map