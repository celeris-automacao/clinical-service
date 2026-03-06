import { Test, TestingModule } from '@nestjs/testing';
import { RewardsService } from '../../rewards/rewards.service';
import { IRewardsRepository } from '../../rewards/repositories/interfaces/rewards.repository.interface';
import { RecordsService } from '../../records/records.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../../achievements/achievements.service'; // Adicione este import

describe('RewardsService - Cobertura Total', () => {
  let service: RewardsService;
  let repository: IRewardsRepository;
  let recordsService: RecordsService;
  let eventEmitter: EventEmitter2;
  let prisma: PrismaService;
  let achievementsService: AchievementsService; // Declare a variável

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
          // CORREÇÃO: Adicionando o AchievementsService que estava faltando
          provide: AchievementsService,
          useValue: { checkLevelAchievements: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) => cb({
              playerStats: {
                findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 0, currentGold: 0 }),
                update: jest.fn().mockResolvedValue({}),
              },
            } as any)),
          },
        },
      ],
    }).compile();

    service = module.get<RewardsService>(RewardsService);
    repository = module.get<IRewardsRepository>('IRewardsRepository');
    recordsService = module.get<RecordsService>(RecordsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    prisma = module.get<PrismaService>(PrismaService);
    achievementsService = module.get<AchievementsService>(AchievementsService); // Inicialize
  });

  describe('getAvailableRewards', () => {
    it('deve mapear recompensas com progresso, status de desbloqueio e resgate', async () => {
      // Mock para as linhas 18, 21-24 da imagem
      jest.spyOn(recordsService, 'getStats').mockResolvedValue({ totalDamage: 500 } as any);
      jest.spyOn(repository, 'findAllActiveByTenant').mockResolvedValue([
        { id: 'r1', requiredDamage: 200 }, // Desbloqueado (500 >= 200)
        { id: 'r2', requiredDamage: 1000 }, // Bloqueado (500 < 1000)
      ] as any);
      jest.spyOn(repository, 'findClaimsByPatient').mockResolvedValue([{ rewardId: 'r1' }] as any);

      const result = await service.getAvailableRewards(mockUser as any);

      // Valida lógica das linhas 26-32
      expect(result[0].unlocked).toBe(true);
      expect(result[0].claimed).toBe(true);
      expect(result[1].unlocked).toBe(false);
      expect(result[1].progress).toBe(50); // (500/1000) * 100
    });
  });

  describe('claimReward', () => {
    // Teste para as linhas 37-39 (Erro: Não encontrada)
    it('deve lançar BadRequestException se a recompensa não existir', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue(null);

      await expect(service.claimReward('invalid-id', mockUser as any))
        .rejects.toThrow(new BadRequestException('Recompensa não encontrada.'));
    });

    // Teste para as linhas 43-45 (Erro: Já resgatado)
    it('deve lançar BadRequestException se o usuário já tiver resgatado', async () => {
      jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'r1' } as any);
      // O Service precisa usar este mock para lançar o erro antes de chegar no stats!
      jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue({ id: 'claim-1' } as any);

      await expect(service.claimReward('r1', mockUser as any))
        .rejects.toThrow(new BadRequestException('Você já resgatou esta recompensa!'));
    });

    // Teste para as linhas 49-53 (Erro: Dano insuficiente)
    it('deve lançar BadRequestException se o dano for menor que o necessário', async () => {
      const mockReward = { id: 'r1', requiredDamage: 1000, goldCost: 100 };

      // 1. Mocks dos Repositórios
      jest.spyOn(repository, 'findById').mockResolvedValue(mockReward as any);
      jest.spyOn(repository, 'findSpecificClaim').mockResolvedValue(null);

      // 2. Mock da Transação (O segredo está aqui!)
      const mockTx = {
        playerStats: {
          findUnique: jest.fn().mockResolvedValue({
            totalDamageDealt: 200, // Dano insuficiente (200 < 1000)
            currentGold: 500
          }),
        }
      };
      // Sobrescrevemos o $transaction global para este teste
      jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

      // 3. Validação
      await expect(service.claimReward('r1', mockUser as any))
        .rejects.toThrow(BadRequestException);
    });

    // Teste para o caminho feliz: Linhas 55-59
    it('deve criar o resgate e emitir evento social com sucesso', async () => {
      const reward = { id: 'r1', title: 'Prêmio Épico', requiredDamage: 100, goldCost: 50 };
      jest.spyOn(repository, 'findById').mockResolvedValue(reward as any);

      const mockTx = {
        playerStats: {
          findUnique: jest.fn().mockResolvedValue({ totalDamageDealt: 500, currentGold: 1000 }),
          update: jest.fn().mockResolvedValue({}),
        }
      };
      jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

      await service.claimReward('r1', mockUser as any);

      expect(repository.createClaim).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });

  it('deve lançar erro se o jogador tiver nível suficiente mas saldo de ouro insuficiente', async () => {
    const mockUser = { userId: 'u1', tenantId: 't1' };
    const mockReward = { id: 'r1', requiredDamage: 100, goldCost: 500 };

    // 1. Mock do Repositório (Encontra a recompensa)
    jest.spyOn(repository, 'findById').mockResolvedValue(mockReward as any);

    // 2. Mock da Transação (Simula o saldo baixo)
    const mockTx = {
      playerStats: {
        findUnique: jest.fn().mockResolvedValue({
          totalDamageDealt: 1000, // Tem nível
          currentGold: 50        // Mas não tem ouro
        }),
      }
    };
    jest.spyOn(prisma, '$transaction').mockImplementation((cb) => cb(mockTx as any));

    // 3. Execução e Expectativa
    await expect(service.claimReward('r1', mockUser as any))
      .rejects.toThrow(/Saldo insuficiente/);
  });
});