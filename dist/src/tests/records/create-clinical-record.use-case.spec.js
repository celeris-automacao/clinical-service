"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const create_clinical_record_use_case_1 = require("../../records/application/use-cases/create-clinical-record.use-case");
const handle_boss_victory_use_case_1 = require("../../records/application/use-cases/handle-boss-victory.use-case");
const clinical_progress_calculator_1 = require("../../records/domain/services/clinical-progress-calculator");
const records_tokens_1 = require("../../records/records.tokens");
describe('CreateClinicalRecordUseCase', () => {
    let useCase;
    let repository;
    let bossBattlePort;
    let playerProgressionPort;
    let recordsAchievementsPort;
    let handleBossVictoryUseCase;
    const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                create_clinical_record_use_case_1.CreateClinicalRecordUseCase,
                clinical_progress_calculator_1.ClinicalProgressCalculator,
                {
                    provide: records_tokens_1.RECORDS_REPOSITORY,
                    useValue: {
                        create: jest.fn(),
                        findAllByPatient: jest.fn().mockResolvedValue([]),
                        findLastTwo: jest.fn().mockResolvedValue([]),
                    },
                },
                {
                    provide: records_tokens_1.PLAYER_PROGRESSION_PORT,
                    useValue: {
                        upsertClinicalProgress: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: records_tokens_1.BOSS_BATTLE_PORT,
                    useValue: {
                        findActiveBoss: jest.fn().mockResolvedValue({ id: 'b1', currentHp: 10000, maxHp: 10000 }),
                        findById: jest.fn().mockResolvedValue({ id: 'b1', name: 'Boss Atual', maxHp: 10000 }),
                        applyDamage: jest.fn().mockResolvedValue(undefined),
                        handleVictory: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: records_tokens_1.RECORDS_ACHIEVEMENTS_PORT,
                    useValue: {
                        checkLevelAchievements: jest.fn().mockResolvedValue(undefined),
                        emitBossDefeated: jest.fn().mockResolvedValue(undefined),
                        emitGlobalVictory: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: handle_boss_victory_use_case_1.HandleBossVictoryUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();
        useCase = module.get(create_clinical_record_use_case_1.CreateClinicalRecordUseCase);
        repository = module.get(records_tokens_1.RECORDS_REPOSITORY);
        bossBattlePort = module.get(records_tokens_1.BOSS_BATTLE_PORT);
        playerProgressionPort = module.get(records_tokens_1.PLAYER_PROGRESSION_PORT);
        recordsAchievementsPort = module.get(records_tokens_1.RECORDS_ACHIEVEMENTS_PORT);
        handleBossVictoryUseCase = module.get(handle_boss_victory_use_case_1.HandleBossVictoryUseCase);
    });
    it('deve criar um registro com sucesso e aplicar dano quando houver perda de peso', async () => {
        const dto = { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 };
        jest.spyOn(repository, 'create').mockResolvedValue({ ...dto, id: '1' });
        jest.spyOn(repository, 'findLastTwo').mockResolvedValue([
            { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 },
            { weight: 82, skeletalMuscleMass: 30, bodyFatMass: 15 },
        ]);
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 80 }]);
        const result = await useCase.execute(dto, mockUser);
        expect(playerProgressionPort.upsertClinicalProgress).toHaveBeenCalledWith({
            patientId: mockUser.userId,
            tenantId: mockUser.tenantId,
            damageDealt: expect.any(Number),
        });
        expect(recordsAchievementsPort.checkLevelAchievements).toHaveBeenCalledWith({
            patientId: mockUser.userId,
            tenantId: mockUser.tenantId,
            newLevel: expect.any(Number),
        });
        expect(result.damage).toBeGreaterThan(0);
        expect(result.message).toContain('ATAQUE');
    });
    it('deve retornar dano zero se o paciente ganhar peso ou manter', async () => {
        const dto = { weight: 85 };
        jest.spyOn(repository, 'create').mockResolvedValue({ weight: 85 });
        jest.spyOn(repository, 'findLastTwo').mockResolvedValue([{ weight: 85 }, { weight: 82 }]);
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 85 }]);
        const result = await useCase.execute(dto, mockUser);
        expect(result.damage).toBe(0);
        expect(result.message).toBe('Registro salvo. Continue focado na sua evolucao!');
    });
    it('deve delegar a vitoria para o use case dedicado', async () => {
        await useCase.handleBossVictory('boss-1', 'tenant-1', 'patient-1');
        expect(handleBossVictoryUseCase.execute).toHaveBeenCalledWith('boss-1', 'tenant-1', 'patient-1');
    });
    it('deve chamar o use case de vitoria quando o dano zerar o hp do boss', async () => {
        jest.spyOn(repository, 'findLastTwo').mockResolvedValue([
            { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 },
            { weight: 82, skeletalMuscleMass: 30, bodyFatMass: 15 },
        ]);
        jest.spyOn(bossBattlePort, 'findActiveBoss').mockResolvedValue({ id: 'boss-1', currentHp: 50, maxHp: 1000 });
        jest.spyOn(repository, 'create').mockResolvedValue({ id: 'r1', weight: 80 });
        jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 80 }]);
        await useCase.execute({ weight: 80 }, mockUser);
        expect(handleBossVictoryUseCase.execute).toHaveBeenCalledWith('boss-1', mockUser.tenantId, mockUser.userId);
    });
});
//# sourceMappingURL=create-clinical-record.use-case.spec.js.map