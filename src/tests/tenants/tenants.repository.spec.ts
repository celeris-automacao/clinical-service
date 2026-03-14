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

  it('deve criar o tenant junto com o boss inicial', async () => {
    const dto: CreateTenantDto = { name: 'Clinica Vida' };

    await repository.create(dto);

    expect(tenantScopedPrismaFactory.forRoot).toHaveBeenCalled();
    expect(rootPrisma.tenant.create).toHaveBeenCalledWith({
      data: {
        name: dto.name,
        bossBattles: {
          create: {
            name: 'Sedentarismo Voraz',
            maxHp: 100000,
            currentHp: 100000,
            isActive: true,
          },
        },
      },
    });
  });

  it('deve buscar um tenant por id', async () => {
    await repository.findById('tenant-1');

    expect(rootPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
    });
  });

  it('deve listar os tenants incluindo a contagem de pacientes', async () => {
    await repository.findAll();

    expect(rootPrisma.tenant.findMany).toHaveBeenCalledWith({
      include: {
        _count: {
          select: { patients: true },
        },
      },
    });
  });
});
