import { Test, TestingModule } from '@nestjs/testing';
import { PrismaRewardsRepository } from '../../rewards/infrastructure/persistence/prisma-rewards.repository';
import { TenantScopedPrismaFactory } from '../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';

describe('PrismaRewardsRepository', () => {
  let repository: PrismaRewardsRepository;
  let tenantScopedPrismaFactory: TenantScopedPrismaFactory;
  const tenantPrisma = {
    reward: { findMany: jest.fn(), findFirst: jest.fn() },
    rewardClaim: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaRewardsRepository,
        {
          provide: TenantScopedPrismaFactory,
          useValue: {
            forTenant: jest.fn().mockReturnValue(tenantPrisma),
            forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaRewardsRepository>(PrismaRewardsRepository);
    tenantScopedPrismaFactory = module.get<TenantScopedPrismaFactory>(TenantScopedPrismaFactory);
  });

  it('deve buscar claims do paciente dentro do tenant', async () => {
    await repository.findClaimsByPatient('u1', 't1');

    expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
      userId: 'u1',
      tenantId: 't1',
    });
    expect(tenantPrisma.rewardClaim.findMany).toHaveBeenCalledWith({
      where: { patientId: 'u1', tenantId: 't1' },
    });
  });

  it('deve filtrar recompensas ativas por tenant', async () => {
    await repository.findAllActiveByTenant('tenant-123');

    expect(tenantScopedPrismaFactory.forTenant).toHaveBeenCalledWith('tenant-123');
    expect(tenantPrisma.reward.findMany).toHaveBeenCalledWith({
      where: { isActive: true, tenantId: 'tenant-123' },
    });
  });

  it('deve buscar recompensa por id dentro do tenant', async () => {
    await repository.findById('r1', 't1');

    expect(tenantPrisma.reward.findFirst).toHaveBeenCalledWith({
      where: { id: 'r1', tenantId: 't1' },
    });
  });

  it('deve buscar claim especifica dentro do tenant', async () => {
    await repository.findSpecificClaim('r1', 'u1', 't1');

    expect(tenantPrisma.rewardClaim.findFirst).toHaveBeenCalledWith({
      where: { rewardId: 'r1', patientId: 'u1', tenantId: 't1' },
    });
  });

  it('deve criar claim com tenant-scoped prisma', async () => {
    const data = { rewardId: 'r1', patientId: 'u1', tenantId: 't1' };

    await repository.createClaim(data);

    expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
      userId: 'u1',
      tenantId: 't1',
    });
    expect(tenantPrisma.rewardClaim.create).toHaveBeenCalledWith({ data });
  });
});
