import { Test, TestingModule } from '@nestjs/testing';
import { BossBattlePort } from '../../records/application/ports/boss-battle.port';
import { PlayerProgressionPort } from '../../records/application/ports/player-progression.port';
import { RecordsAchievementsPort } from '../../records/application/ports/records-achievements.port';
import { CreateClinicalRecordUseCase } from '../../records/application/use-cases/create-clinical-record.use-case';
import { HandleBossVictoryUseCase } from '../../records/application/use-cases/handle-boss-victory.use-case';
import { ClinicalProgressCalculator } from '../../records/domain/services/clinical-progress-calculator';
import { IRecordsRepository } from '../../records/application/ports/records-repository.port';
import {
  BOSS_BATTLE_PORT,
  PLAYER_PROGRESSION_PORT,
  RECORDS_ACHIEVEMENTS_PORT,
  RECORDS_REPOSITORY,
} from '../../records/records.tokens';

describe('CreateClinicalRecordUseCase', () => {
  let useCase: CreateClinicalRecordUseCase;
  let repository: IRecordsRepository;
  let bossBattlePort: BossBattlePort;
  let playerProgressionPort: PlayerProgressionPort;
  let recordsAchievementsPort: RecordsAchievementsPort;
  let handleBossVictoryUseCase: HandleBossVictoryUseCase;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateClinicalRecordUseCase,
        ClinicalProgressCalculator,
        {
          provide: RECORDS_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findAllByPatient: jest.fn().mockResolvedValue([]),
            findLastTwo: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PLAYER_PROGRESSION_PORT,
          useValue: {
            upsertClinicalProgress: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BOSS_BATTLE_PORT,
          useValue: {
            findActiveBoss: jest.fn().mockResolvedValue({ id: 'b1', currentHp: 10000, maxHp: 10000 }),
            findById: jest.fn().mockResolvedValue({ id: 'b1', maxHp: 10000 }),
            applyDamage: jest.fn().mockResolvedValue(undefined),
            handleVictory: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RECORDS_ACHIEVEMENTS_PORT,
          useValue: {
            checkLevelAchievements: jest.fn().mockResolvedValue(undefined),
            emitGlobalVictory: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: HandleBossVictoryUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    useCase = module.get<CreateClinicalRecordUseCase>(CreateClinicalRecordUseCase);
    repository = module.get<IRecordsRepository>(RECORDS_REPOSITORY);
    bossBattlePort = module.get<BossBattlePort>(BOSS_BATTLE_PORT);
    playerProgressionPort = module.get<PlayerProgressionPort>(PLAYER_PROGRESSION_PORT);
    recordsAchievementsPort = module.get<RecordsAchievementsPort>(RECORDS_ACHIEVEMENTS_PORT);
    handleBossVictoryUseCase = module.get<HandleBossVictoryUseCase>(HandleBossVictoryUseCase);
  });

  describe('execute', () => {
    it('deve criar um registro com sucesso e aplicar dano quando houver perda de peso', async () => {
      const dto = { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 };

      jest.spyOn(repository, 'create').mockResolvedValue({ ...dto, id: '1' } as any);
      jest.spyOn(repository, 'findLastTwo').mockResolvedValue([
        { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 },
        { weight: 82, skeletalMuscleMass: 30, bodyFatMass: 15 },
      ] as any);
      jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 80 }] as any);

      const result = await useCase.execute(dto as any, mockUser as any);

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

      jest.spyOn(repository, 'create').mockResolvedValue({ weight: 85 } as any);
      jest.spyOn(repository, 'findLastTwo').mockResolvedValue([{ weight: 85 }, { weight: 82 }] as any);
      jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 85 }] as any);

      const result = await useCase.execute(dto as any, mockUser as any);

      expect(result.damage).toBe(0);
      expect(result.message).toBe('Registro salvo. Continue focado na sua evolução!');
    });
  });

  describe('handleBossVictory', () => {
    it('deve delegar a vitória para o use case dedicado', async () => {
      await useCase.handleBossVictory('boss-1', 'tenant-1');

      expect(handleBossVictoryUseCase.execute).toHaveBeenCalledWith('boss-1', 'tenant-1');
    });
  });

  describe('calculateAndApplyDamage', () => {
    it('deve chamar o use case de vitória quando o dano zerar o hp do boss', async () => {
      jest.spyOn(repository, 'findLastTwo').mockResolvedValue([
        { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 },
        { weight: 82, skeletalMuscleMass: 30, bodyFatMass: 15 },
      ] as any);
      jest.spyOn(bossBattlePort, 'findActiveBoss').mockResolvedValue({ id: 'boss-1', currentHp: 50, maxHp: 1000 });
      jest.spyOn(repository, 'create').mockResolvedValue({ id: 'r1', weight: 80 } as any);
      jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 80 }] as any);

      await useCase.execute({ weight: 80 } as any, mockUser as any);

      expect(handleBossVictoryUseCase.execute).toHaveBeenCalledWith('boss-1', mockUser.tenantId);
    });
  });
});
