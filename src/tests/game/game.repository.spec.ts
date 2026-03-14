// src/tests/game/game.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { GameRepository } from '../../game/repositories/game.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('GameRepository', () => {
  let repository: GameRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameRepository,
        {
          provide: PrismaService,
          useValue: {
            playerStats: { findUnique: jest.fn() },
            bossBattle: { findFirst: jest.fn() },
          },
        },
      ],
    }).compile();

    repository = module.get<GameRepository>(GameRepository);
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
