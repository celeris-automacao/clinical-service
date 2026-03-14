import { Test, TestingModule } from '@nestjs/testing';
import { PrismaGameRepository } from '../../game/infrastructure/persistence/prisma-game.repository';
import { TenantScopedPrismaFactory } from '../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';

describe('PrismaGameRepository', () => {
  let repository: PrismaGameRepository;
  let tenantScopedPrismaFactory: TenantScopedPrismaFactory;
  const tenantPrisma = {
    playerStats: { findFirst: jest.fn() },
    bossBattle: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaGameRepository,
        {
          provide: TenantScopedPrismaFactory,
          useValue: {
            forTenant: jest.fn().mockReturnValue(tenantPrisma),
            forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaGameRepository>(PrismaGameRepository);
    tenantScopedPrismaFactory = module.get<TenantScopedPrismaFactory>(TenantScopedPrismaFactory);
  });

  it('findPlayerProgress deve buscar pelo patientId dentro do tenant', async () => {
    await repository.findPlayerProgress('u1', 't1');

    expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
      userId: 'u1',
      tenantId: 't1',
    });
    expect(tenantPrisma.playerStats.findFirst).toHaveBeenCalledWith({
      where: { patientId: 'u1', tenantId: 't1' },
    });
  });

  it('findActiveBoss deve buscar apenas o boss ativo da clinica', async () => {
    await repository.findActiveBoss('tenant-1');

    expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-1');
    expect(tenantPrisma.bossBattle.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true },
    });
  });
});
