"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const rewards_service_1 = require("../../rewards/rewards.service");
const records_service_1 = require("../../records/records.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const achievements_service_1 = require("../../achievements/achievements.service");
describe('RewardsService - Cobertura Total', () => {
    let service;
    let repository;
    let recordsService;
    let eventEmitter;
    let prisma;
    let achievementsService;
    const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                rewards_service_1.RewardsService,
                {
                    provide: 'IRewardsRepository',
                    useValue: {
                        findAllActiveByTenant: jest.fn(),
                        findClaimsByPatient: jest.fn(),
                        findById: jest.fn(),
                        findSpecificClaim: jest.fn(),
                        createClaim: jest.fn(),
                    },
                },
                {
                    provide: records_service_1.RecordsService,
                    useValue: { getStats: jest.fn() },
                },
                {
                    provide: event_emitter_1.EventEmitter2,
                    useValue: { emit: jest.fn() },
                },
                {
                    provide: achievements_service_1.AchievementsService,
                    useValue: { checkLevelAchievements: jest.fn() },
                },
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        $transaction: jest.fn((cb) => cb({
                            playerStats: {
                                findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 0, currentGold: 0 }),
                                update: jest.fn().mockResolvedValue({}),
                            },
                        })),
                    },
                },
            ],
        }).compile();
        service = module.get(rewards_service_1.RewardsService);
        repository = module.get('IRewardsRepository');
        recordsService = module.get(records_service_1.RecordsService);
        eventEmitter = module.get(event_emitter_1.EventEmitter2);
        prisma = module.get(prisma_service_1.PrismaService);
        achievementsService = module.get(achievements_service_1.AchievementsService);
    });
    describe('getAvailableRewards', () => {
        it('deve mapear recompensas com progresso, status de desbloqueio e resgate', async () => {
            jest.spyOn(recordsService, 'getStats').mockResolvedValue({ totalDamage: 500 });
            jest.spyOn(repository, 'findAllActiveByTenant').mockResolvedValue([
                { id: 'r1', requiredDamage: 200 },
                { id: 'r2', requiredDamage: 1000 },
            ]);
            jest.spyOn(repository, 'findClaimsByPatient').mockResolvedValue([{ rewardId: 'r1' }]);
            const result = await service.getAvailableRewards(mockUser);
            expect(result[0].unlocked).toBe(true);
            expect(result[0].claimed).toBe(true);
            expect(result[1].unlocked).toBe(false);
            expect(result[1].progress).toBe(50);
        });
    });
    describe('claimReward', () => {
        it('deve lançar BadRequestException se a recompensa não existir', async () => {
            jest.spyOn(repository, 'findById').mockResolvedValue(null);
            await expect(service.claimReward('invalid-id', mockUser))
                .rejects.toThrow(new common_1.BadRequestException('Recompensa não encontrada.'));
        });
        it('deve lançar BadRequestException se o usuário já tiver resgatado', async () => {
            jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'r1' });
            jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue({ id: 'claim-1' });
            await expect(service.claimReward('r1', mockUser))
                .rejects.toThrow(new common_1.BadRequestException('Você já resgatou esta recompensa!'));
        });
        it('deve lançar BadRequestException se o dano for menor que o necessário', async () => {
            const mockReward = { id: 'r1', requiredDamage: 1000, goldCost: 100 };
            jest.spyOn(repository, 'findById').mockResolvedValue(mockReward);
            jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue(null);
            const mockTx = {
                playerStats: {
                    findUnique: jest.fn().mockResolvedValue({
                        totalDamageDealt: 200,
                        currentGold: 500
                    }),
                }
            };
            jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx));
            await expect(service.claimReward('r1', mockUser))
                .rejects.toThrow(common_1.BadRequestException);
        });
        it('deve criar o resgate e emitir evento social com sucesso', async () => {
            const reward = { id: 'r1', title: 'Prêmio Épico', requiredDamage: 100, goldCost: 50 };
            jest.spyOn(repository, 'findById').mockResolvedValue(reward);
            const mockTx = {
                playerStats: {
                    findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 500, currentGold: 1000 }),
                    update: jest.fn().mockResolvedValue({}),
                }
            };
            jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx));
            await service.claimReward('r1', mockUser);
            expect(repository.createClaim).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalled();
        });
    });
    it('deve lançar erro se o jogador tiver nível suficiente mas saldo de ouro insuficiente', async () => {
        const mockUser = { userId: 'u1', tenantId: 't1' };
        const mockReward = { id: 'r1', requiredDamage: 100, goldCost: 500 };
        jest.spyOn(repository, 'findById').mockResolvedValue(mockReward);
        const mockTx = {
            playerStats: {
                findUnique: jest.fn().mockResolvedValue({
                    totalDamageDealt: 1000,
                    currentGold: 50
                }),
            }
        };
        jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx));
        await expect(service.claimReward('r1', mockUser))
            .rejects.toThrow(/Saldo insuficiente/);
    });
});
//# sourceMappingURL=rewards.service.spec.js.map