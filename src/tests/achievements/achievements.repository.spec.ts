import { Test, TestingModule } from '@nestjs/testing';
import { PrismaAchievementsRepository } from '../../achievements/infrastructure/persistence/prisma-achievements.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('PrismaAchievementsRepository', () => {
  let repository: PrismaAchievementsRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaAchievementsRepository,
        {
          provide: PrismaService,
          useValue: {
            reward: { upsert: jest.fn() },
            rewardClaim: { findFirst: jest.fn(), create: jest.fn() },
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaAchievementsRepository>(PrismaAchievementsRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('getOrCreateBadge deve usar upsert com a chave composta (title_tenantId)', async () => {
    await repository.getOrCreateBadge('t1', 'Badge Teste', 'icon-1');

    expect(prisma.reward.upsert).toHaveBeenCalledWith({
      where: { title_tenantId: { title: 'Badge Teste', tenantId: 't1' } },
      update: {},
      create: expect.objectContaining({ title: 'Badge Teste', tenantId: 't1' })
    });
  });

  it('createClaim deve salvar o registro de ganho da medalha', async () => {
    await repository.createClaim('p1', 't1', 'r1');

    expect(prisma.rewardClaim.create).toHaveBeenCalledWith({
      data: { rewardId: 'r1', patientId: 'p1', tenantId: 't1' }
    });
  });
});
