// src/tests/rewards/rewards.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RewardsRepository } from '../../rewards/repositories/rewards.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('RewardsRepository - Cobertura Total', () => {
  let repository: RewardsRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsRepository,
        {
          provide: PrismaService,
          useValue: {
            reward: { findMany: jest.fn(), findUnique: jest.fn() },
            rewardClaim: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
          },
        },
      ],
    }).compile();

    repository = module.get<RewardsRepository>(RewardsRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve executar findClaimsByPatient (Linhas 17-21)', async () => {
    const spy = jest.spyOn(prisma.rewardClaim, 'findMany').mockResolvedValue([]);
    await repository.findClaimsByPatient('u1');
    expect(spy).toHaveBeenCalledWith({ where: { patientId: 'u1' } }); //
  });

  it('findClaimsByPatient deve buscar o histórico do paciente', async () => {
    const patientId = 'u1';
    const spy = jest.spyOn(prisma.rewardClaim, 'findMany').mockResolvedValue([]);
    
    await repository.findClaimsByPatient(patientId);
    
    expect(spy).toHaveBeenCalledWith({ where: { patientId } });
  });

  it('findAllActiveByTenant deve filtrar por clínica e recompensas ativas', async () => {
    const tenantId = 'tenant-123';
    const spy = jest.spyOn(prisma.reward, 'findMany').mockResolvedValue([]);

    await repository.findAllActiveByTenant(tenantId);

    expect(spy).toHaveBeenCalledWith({
      where: { tenantId, isActive: true },
    });
  });

  it('deve executar findById (Linhas 23-27)', async () => {
    const spy = jest.spyOn(prisma.reward, 'findUnique').mockResolvedValue(null);
    await repository.findById('r1');
    expect(spy).toHaveBeenCalledWith({ where: { id: 'r1' } }); //
  });

  it('deve executar findSpecificClaim (Linhas 29-33)', async () => {
    const spy = jest.spyOn(prisma.rewardClaim, 'findFirst').mockResolvedValue(null);
    await repository.findSpecificClaim('r1', 'u1');
    expect(spy).toHaveBeenCalledWith({ where: { rewardId: 'r1', patientId: 'u1' } }); //
  });

  it('deve executar createClaim (Linhas 35-37)', async () => {
    const data = { rewardId: 'r1', patientId: 'u1', tenantId: 't1' };
    const spy = jest.spyOn(prisma.rewardClaim, 'create').mockResolvedValue({} as any);
    await repository.createClaim(data);
    expect(spy).toHaveBeenCalledWith({ data }); //
  });
});