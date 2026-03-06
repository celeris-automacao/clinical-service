// src/tests/records/records.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RecordsService } from '../../records/records.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../../achievements/achievements.service';
import { IRecordsRepository } from '../../records/repositories/interfaces/records.repository.interface';

describe('RecordsService', () => {
  let service: RecordsService;
  let repository: IRecordsRepository;
  let prisma: PrismaService;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    // Criamos os mocks fora para que todos (inclusive a transação) usem os mesmos
    const mockBossBattle = {
      update: jest.fn().mockResolvedValue({ id: 'b1', maxHp: 10000 }),
      findUnique: jest.fn().mockResolvedValue({ id: 'b1', maxHp: 10000 }),
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue({ id: 'b1', currentHp: 10000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsService,
        {
          provide: 'IRecordsRepository',
          useValue: { create: jest.fn(), findAllByPatient: jest.fn().mockResolvedValue([]), findLastTwo: jest.fn().mockResolvedValue([]) }
        },
        {
          provide: PrismaService,
          useValue: {
            bossBattle: mockBossBattle,
            playerStats: { updateMany: jest.fn().mockResolvedValue({}), update: jest.fn(), findUnique: jest.fn() },
            // A transação agora repassa as chamadas para o mockBossBattle que criamos acima
            $transaction: jest.fn(async (cb) => cb({
              bossBattle: mockBossBattle,
              playerStats: { updateMany: jest.fn().mockResolvedValue({}) }
            } as any)),
          },
        },
        { provide: AchievementsService, useValue: { checkLevelAchievements: jest.fn(), emitGlobalVictory: jest.fn() } },
      ],
    }).compile();

    service = module.get<RecordsService>(RecordsService);
    prisma = module.get<PrismaService>(PrismaService);
    repository = module.get<IRecordsRepository>('IRecordsRepository');
  });

  describe('createRecord', () => {
    it('deve criar um registro com sucesso e aplicar dano quando houver perda de peso', async () => {
      const dto = { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 };

      jest.spyOn(repository, 'create').mockResolvedValue({ ...dto, id: '1' } as any);
      jest.spyOn(repository, 'findLastTwo').mockResolvedValue([
        { weight: 80, skeletalMuscleMass: 30, bodyFatMass: 15 },
        { weight: 82, skeletalMuscleMass: 30, bodyFatMass: 15 }
      ] as any);

      jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 80 }] as any);

      const result = await service.createRecord(dto as any, mockUser as any);

      expect(result.damage).toBeGreaterThan(0);
      expect(result.message).toContain('ATAQUE CRÍTICO');
    });

    it('deve retornar dano zero se o paciente ganhar peso ou manter', async () => {
      const dto = { weight: 85 };
      jest.spyOn(repository, 'create').mockResolvedValue({ weight: 85 } as any);
      jest.spyOn(repository, 'findLastTwo').mockResolvedValue([{ weight: 85 }, { weight: 82 }] as any);
      jest.spyOn(repository, 'findAllByPatient').mockResolvedValue([{ weight: 82 }, { weight: 85 }] as any);

      const result = await service.createRecord(dto as any, mockUser as any);

      expect(result.damage).toBe(0);
      expect(result.message).toBe("Registro salvo. Continue focado na sua evolução!");
    });
  });

  describe('handleBossVictory', () => {
    it('deve desativar o boss atual, premiar a clínica e criar um novo vilão clínico', async () => {
      const bossId = 'old-boss-id';
      const tenantId = 'tenant-1';
      const oldBoss = { id: bossId, maxHp: 10000, tenantId };

      jest.spyOn(prisma.bossBattle, 'findUnique').mockResolvedValue(oldBoss as any);

      await service.handleBossVictory(bossId, tenantId);

      // Valida o encerramento do antigo
      expect(prisma.bossBattle.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: bossId },
        data: expect.objectContaining({ isActive: false, currentHp: 0 })
      }));

      // Valida a criação do novo com HP +15%
      expect(prisma.bossBattle.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          maxHp: 11500,
          isActive: true
        })
      }));

      const createCall = (prisma.bossBattle.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.name).toMatch(/Gordura|Sedentarismo|Acomodação|Desidratação|Inflamação|Sarcopenia/);
    });
  });
});