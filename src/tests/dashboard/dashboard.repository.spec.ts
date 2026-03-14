import { Test, TestingModule } from '@nestjs/testing';
import { DashboardRepository } from '../../dashboard/repositories/dashboard.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardRepository', () => {
  let repository: DashboardRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardRepository,
        {
          provide: PrismaService,
          useValue: {
            playerStats: {
              count: jest.fn(),
              findMany: jest.fn(),
            },
            socialPost: {
              findMany: jest.fn(),
            },
            rewardClaim: {
              findMany: jest.fn(),
            },
            taskCompletion: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<DashboardRepository>(DashboardRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('countActivePlayers', () => {
    it('deve chamar prisma.playerStats.count com os filtros de tenant e data de atividade', async () => {
      const tenantId = 'tenant-abc';
      const since = new Date('2026-01-01');
      
      await repository.countActivePlayers(tenantId, since);

      expect(prisma.playerStats.count).toHaveBeenCalledWith({
        where: {
          tenantId,
          lastActivityAt: { gte: since },
        },
      });
    });
  });

  describe('findRecentAchievements', () => {
    it('deve buscar posts do tipo achievement com ordenação decrescente', async () => {
      const tenantId = 'tenant-abc';
      const limit = 5;

      await repository.findRecentAchievements(tenantId, limit);

      expect(prisma.socialPost.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          type: 'achievement',
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          patient: { select: { name: true } },
        },
      });
    });
  });

  describe('findTopPlayers', () => {
    it('deve chamar o ranking de dano total incluindo o nome do paciente', async () => {
      const tenantId = 'tenant-abc';
      
      await repository.findTopPlayers(tenantId, 3);

      expect(prisma.playerStats.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { totalDamageDealt: 'desc' },
        take: 3,
        include: {
          patient: { select: { name: true } },
        },
      });
    });
  });

  describe('getTaskCompletionsHistory', () => {
    it('deve buscar o histórico de conclusões para o cálculo de retenção', async () => {
      const tenantId = 'tenant-abc';

      await repository.getTaskCompletionsHistory(tenantId);

      expect(prisma.taskCompletion.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        select: {
          patientId: true,
          completedAt: true,
        },
        orderBy: {
          completedAt: 'desc',
        },
      });
    });
  });

  describe('findRecentClaims', () => {
    it('deve buscar os resgates recentes por tenant com reward incluído', async () => {
      const tenantId = 'tenant-abc';

      await repository.findRecentClaims(tenantId, 10);

      expect(prisma.rewardClaim.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: { reward: true },
        orderBy: { claimedAt: 'desc' },
        take: 10,
      });
    });
  });
});
