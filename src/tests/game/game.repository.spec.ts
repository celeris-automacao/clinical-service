// src/tests/game/game.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaGameRepository } from '../../game/infrastructure/persistence/prisma-game.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('PrismaGameRepository', () => {
  let repository: PrismaGameRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaGameRepository,
        {
          provide: PrismaService,
          useValue: {
            playerStats: { findUnique: jest.fn() },
            bossBattle: { findFirst: jest.fn() },
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaGameRepository>(PrismaGameRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('findPlayerProgress deve buscar pelo patientId único', async () => {
    await repository.findPlayerProgress('u1');
    expect(prisma.playerStats.findUnique).toHaveBeenCalledWith({
      where: { patientId: 'u1' },
    });
  });

  it('findActiveBoss deve buscar apenas o Boss ativo da clínica', async () => {
    await repository.findActiveBoss('tenant-1');
    expect(prisma.bossBattle.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true },
    });
  });
});
