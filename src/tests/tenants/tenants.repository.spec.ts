import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto } from '../../tenants/presentation/http/dto/create-tenant.dto';
import { TenantsRepository } from '../../tenants/infrastructure/persistence/prisma-tenants.repository';

describe('TenantsRepository', () => {
  let repository: TenantsRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsRepository,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<TenantsRepository>(TenantsRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve criar o tenant junto com o boss inicial', async () => {
    const dto: CreateTenantDto = { name: 'Clinica Vida' };

    await repository.create(dto);

    expect(prisma.tenant.create).toHaveBeenCalledWith({
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

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
    });
  });

  it('deve listar os tenants incluindo a contagem de pacientes', async () => {
    await repository.findAll();

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      include: {
        _count: {
          select: { patients: true },
        },
      },
    });
  });
});
