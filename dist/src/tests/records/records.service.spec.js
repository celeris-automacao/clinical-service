"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const records_service_1 = require("../../records/records.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const achievements_service_1 = require("../../achievements/achievements.service");
describe('RecordsService', () => {
    let service;
    let repository;
    let prisma;
    const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const mockBossBattle = {
            update: jest.fn().mockResolvedValue({ id: 'b1', maxHp: 10000 }),
            findUnique: jest.fn().mockResolvedValue({ id: 'b1', maxHp: 10000 }),
            create: jest.fn().mockResolvedValue({}),
            findFirst: jest.fn().mockResolvedValue({ id: 'b1', currentHp: 10000 }),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                records_service_1.RecordsService,
                {
                    provide: 'IRecordsRepository',
                    useValue: { create: jest.fn(), findAllByPatient: jest.fn().mockResolvedValue([]), findLastTwo: jest.fn().mockResolvedValue([]) }
                },
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        bossBattle: mockBossBattle,
                        playerStats: { updateMany: jest.fn().mockResolvedValue({}), update: jest.fn(), findUnique: jest.fn() },
                        $transaction: jest.fn(async (cb) => cb({
                            bossBattle: mockBossBattle,
                            playerStats: { updateMany: jest.fn().mockResolvedValue({}) }
                        })),
                    },
                },
                { provide: achievements_service_1.AchievementsService, useValue: { checkLevelAchievements: jest.fn(), emitGlobalVictory: jest.fn() } },
            ],
        }).compile();
        service = module.get(records_service_1.RecordsService);
        prisma = module.get(prisma_service_1.PrismaService);
        repository = module.get('IRecordsRepository');
    });
    describe('createRecord', () => {
        it('deve criar um registro com sucesso e aplicar dano quando houver perda de peso', async () => {
            const dto = { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 };
            jest.spyOn(repository, 'create').mockResolvedValue({ ...dto, id: '1' });
            jest.spyOn(repository, 'findLastTwo').mockResolvedValue([
                { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 },
                { weight: 82, skeletalMuscleMass: 30, bodyFatMass: 15 }
            ]);
            jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 80 }]);
            const result = await service.createRecord(dto, mockUser);
            expect(result.damage).toBeGreaterThan(0);
            expect(result.message).toContain('ATAQUE CRÍTICO');
        });
        it('deve retornar dano zero se o paciente ganhar peso ou manter', async () => {
            const dto = { weight: 85 };
            jest.spyOn(repository, 'create').mockResolvedValue({ weight: 85 });
            jest.spyOn(repository, 'findLastTwo').mockResolvedValue([{ weight: 85 }, { weight: 82 }]);
            jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 85 }]);
            const result = await service.createRecord(dto, mockUser);
            expect(result.damage).toBe(0);
            expect(result.message).toBe("Registro salvo. Continue focado na sua evolução!");
        });
    });
    describe('handleBossVictory', () => {
        it('deve desativar o boss atual, premiar a clínica e criar um novo vilão clínico', async () => {
            const bossId = 'old-boss-id';
            const tenantId = 'tenant-1';
            const oldBoss = { id: bossId, maxHp: 10000, tenantId };
            jest.spyOn(prisma.bossBattle, 'findUnique').mockResolvedValue(oldBoss);
            await service.handleBossVictory(bossId, tenantId);
            expect(prisma.bossBattle.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: bossId },
                data: expect.objectContaining({ isActive: false, currentHp: 0 })
            }));
            expect(prisma.bossBattle.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    maxHp: 11500,
                    isActive: true
                })
            }));
            const createCall = prisma.bossBattle.create.mock.calls[0][0];
            expect(createCall.data.name).toMatch(/Gordura|Sedentarismo|Acomodação|Desidratação|Inflamação|Sarcopenia/);
        });
    });
});
//# sourceMappingURL=records.service.spec.js.map