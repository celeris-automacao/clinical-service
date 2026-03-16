import { Test, TestingModule } from '@nestjs/testing';
import { TenantScopedPrismaFactory } from '../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { CreateTenantDto } from '../../tenants/presentation/http/dto/create-tenant.dto';
import { PrismaTenantsRepository } from '../../tenants/infrastructure/persistence/prisma-tenants.repository';

describe('PrismaTenantsRepository', () => {
  let repository: PrismaTenantsRepository;
  let tenantScopedPrismaFactory: TenantScopedPrismaFactory;

  const rootPrisma = {
    tenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    plan: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTenantsRepository,
        {
          provide: TenantScopedPrismaFactory,
          useValue: {
            forRoot: jest.fn().mockReturnValue(rootPrisma),
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaTenantsRepository>(PrismaTenantsRepository);
    tenantScopedPrismaFactory = module.get<TenantScopedPrismaFactory>(TenantScopedPrismaFactory);
  });

  it('deve criar o tenant junto com plano, endereco e boss inicial', async () => {
    const dto: CreateTenantDto = {
      name: 'Clinica Vida',
      legalName: 'Clinica Vida LTDA',
      cnpj: '12345678000199',
      planId: 'plan-1',
      responsibleName: 'Helena Costa',
      responsibleEmail: 'owner@clinica.com',
      responsiblePhone: '11999999999',
      address: {
        zipCode: '01311000',
        street: 'Av Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
      },
    };

    await repository.create(dto);

    expect(tenantScopedPrismaFactory.forRoot).toHaveBeenCalled();
    expect(rootPrisma.tenant.create).toHaveBeenCalled();
  });

  it('deve buscar um tenant por id incluindo plano e endereco', async () => {
    await repository.findById('tenant-1');

    expect(rootPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      include: {
        plan: true,
        address: true,
      },
    });
  });

  it('deve listar os tenants incluindo plano, endereco e contagens operacionais', async () => {
    await repository.findAll();

    expect(rootPrisma.tenant.findMany).toHaveBeenCalledWith({
      include: {
        plan: true,
        address: true,
        _count: {
          select: { patients: true, staff: true },
        },
      },
    });
  });

  it('deve buscar plano ativo por id', async () => {
    await repository.findActivePlanById('plan-1');

    expect(rootPrisma.plan.findFirst).toHaveBeenCalledWith({
      where: { id: 'plan-1', isActive: true },
    });
  });

  it('deve alterar o status operacional do tenant', async () => {
    await repository.updateStatus('tenant-1', 'inactive');

    expect(rootPrisma.tenant.update).toHaveBeenCalled();
  });
});
