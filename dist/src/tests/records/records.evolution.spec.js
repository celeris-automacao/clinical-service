"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const records_service_1 = require("../../records/records.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const achievements_service_1 = require("../../achievements/achievements.service");
const event_emitter_1 = require("@nestjs/event-emitter");
describe('RecordsService - Evolution & Ranking', () => {
    let service;
    let repository;
    const mockUser = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'patient'
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                records_service_1.RecordsService,
                {
                    provide: 'IRecordsRepository',
                    useValue: {
                        findAllByPatient: jest.fn(),
                        findLastTwo: jest.fn(),
                    },
                },
                { provide: prisma_service_1.PrismaService, useValue: { bossBattle: { updateMany: jest.fn() }, playerStats: { update: jest.fn() } } },
                { provide: achievements_service_1.AchievementsService, useValue: { checkLevelAchievements: jest.fn() } },
                { provide: event_emitter_1.EventEmitter2, useValue: { emit: jest.fn() } },
            ],
        }).compile();
        service = module.get(records_service_1.RecordsService);
        repository = module.get('IRecordsRepository');
    });
    it('deve calcular corretamente o dano total acumulado (12kg = 92.400 kcal)', async () => {
        const history = [
            { weight: 100 },
            { weight: 90 },
            { weight: 95 },
            { weight: 93 },
        ];
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history);
        const stats = await service.getStats(mockUser);
        expect(stats.totalWeightLoss).toBe(12);
        expect(stats.totalDamage).toBe(92400);
    });
    it('deve atribuir o Rank "Guerreiro de Elite" para danos acima de 50.000', async () => {
        const history = [{ weight: 100 }, { weight: 90 }];
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history);
        const stats = await service.getStats(mockUser);
        expect(stats.rank).toBe('Guerreiro de Elite');
    });
    it('deve calcular o progresso de nível corretamente', async () => {
        const history = [{ weight: 81 }, { weight: 80 }];
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue(history);
        const stats = await service.getStats(mockUser);
        expect(stats.currentLevel).toBeGreaterThanOrEqual(1);
        expect(stats.progressPercentage).toBeDefined();
    });
});
//# sourceMappingURL=records.evolution.spec.js.map