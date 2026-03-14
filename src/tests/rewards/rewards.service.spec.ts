import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordsService } from '../../records/records.service';
import { RewardsService } from '../../rewards/rewards.service';
import { IRewardsRepository } from '../../rewards/repositories/interfaces/rewards.repository.interface';

describe('RewardsService - Cobertura Total', () => {
  let service: RewardsService;
  let repository: IRewardsRepository;
  let recordsService: RecordsService;
  let eventEmitter: EventEmitter2;
  let prisma: PrismaService;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsService,
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
          provide: RecordsService,
          useValue: { getStats: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) =>
              cb({
                playerStats: {
                  findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 0, currentGold: 0 }),
                  update: jest.fn().mockResolvedValue({}),
                },
              } as any),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<RewardsService>(RewardsService);
    repository = module.get<IRewardsRepository>('IRewardsRepository');
    recordsService = module.get<RecordsService>(RecordsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getAvailableRewards', () => {
    it('deve mapear recompensas com progresso, status de desbloqueio e resgate', async () => {
      jest.spyOn(recordsService, 'getStats').mockResolvedValue({ totalDamage: 500 } as any);
      jest.spyOn(repository, 'findAllActiveByTenant').mockResolvedValue([
        { id: 'r1', requiredDamage: 200 },
        { id: 'r2', requiredDamage: 1000 },
      ] as any);
      jest.spyOn(repository, 'findClaimsByPatient').mockResolvedValue([{ rewardId: 'r1' }] as any);

      const result = await service.getAvailableRewards(mockUser as any);

      expect(result[0].unlocked).toBe(true);
      expect(result[0].claimed).toBe(true);
      expect(result[1].unlocked).toBe(false);
      expect(result[1].progress).toBe(50);
    });
  });

  describe('claimReward', () => {
    it('deve lançar BadRequestException se a recompensa não existir', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      await expect(service.claimReward('invalid-id', mockUser as any)).rejects.toThrow(
        new BadRequestException('Recompensa não encontrada.'),
      );
    });

    it('deve lançar BadRequestException se o usuário já tiver resgatado', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'r1' } as any);
      jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue({ id: 'claim-1' } as any);

      await expect(service.claimReward('r1', mockUser as any)).rejects.toThrow(
        new BadRequestException('Você já resgatou esta recompensa!'),
      );
    });

    it('deve lançar BadRequestException se o dano for menor que o necessário', async () => {
      const mockReward = { id: 'r1', requiredDamage: 1000, goldCost: 100 };

      jest.spyOn(repository, 'findById').mockResolvedValue(mockReward as any);
      jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue(null);

      const mockTx = {
        playerStats: {
          findUnique: jest.fn().mockResolvedValue({
            totalDamageDealt: 200,
            currentGold: 500,
          }),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

      await expect(service.claimReward('r1', mockUser as any)).rejects.toThrow(BadRequestException);
    });

    it('deve criar o resgate e emitir evento social com sucesso', async () => {
      const reward = { id: 'r1', title: 'Prêmio Épico', requiredDamage: 100, goldCost: 50 };
      jest.spyOn(repository, 'findById').mockResolvedValue(reward as any);
      jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue(null);

      const mockTx = {
        playerStats: {
          findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 500, currentGold: 1000 }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

      await service.claimReward('r1', mockUser as any);

      expect(repository.createClaim).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });

  it('deve lançar erro se o jogador tiver nível suficiente mas saldo de ouro insuficiente', async () => {
    const reward = { id: 'r1', requiredDamage: 100, goldCost: 500 };

    jest.spyOn(repository, 'findById').mockResolvedValue(reward as any);
    jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue(null);

    const mockTx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue({
          totalDamageDealt: 1000,
          currentGold: 50,
        }),
      },
    };
    jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

    await expect(service.claimReward('r1', mockUser as any)).rejects.toThrow(/Saldo insuficiente/);
  });
});
