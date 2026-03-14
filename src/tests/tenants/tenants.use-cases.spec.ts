import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateTenantDto } from '../../tenants/dto/create-tenant.dto';
import { CreateTenantUseCase } from '../../tenants/application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from '../../tenants/application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from '../../tenants/application/use-cases/get-tenants.use-case';
import { TenantsRepositoryPort } from '../../tenants/application/ports/tenants-repository.port';
import { TENANTS_REPOSITORY } from '../../tenants/tenants.tokens';

describe('Tenants Use Cases', () => {
  let repository: TenantsRepositoryPort;
  let createTenantUseCase: CreateTenantUseCase;
  let getTenantsUseCase: GetTenantsUseCase;
  let getTenantByIdUseCase: GetTenantByIdUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTenantUseCase,
        GetTenantsUseCase,
        GetTenantByIdUseCase,
        {
          provide: TENANTS_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<TenantsRepositoryPort>(TENANTS_REPOSITORY);
    createTenantUseCase = module.get<CreateTenantUseCase>(CreateTenantUseCase);
    getTenantsUseCase = module.get<GetTenantsUseCase>(GetTenantsUseCase);
    getTenantByIdUseCase = module.get<GetTenantByIdUseCase>(GetTenantByIdUseCase);
  });

  it('deve delegar a criação do tenant para o repositório', async () => {
    const dto: CreateTenantDto = { name: 'Clinica Vida' };
    const createdTenant = { id: 'tenant-1', name: dto.name };

    jest.spyOn(repository, 'create').mockResolvedValue(createdTenant);

    const result = await createTenantUseCase.execute(dto);

    expect(repository.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdTenant);
  });

  it('deve listar todos os tenants usando o repositório', async () => {
    const tenants = [{ id: 'tenant-1', name: 'Clinica Vida' }];

    jest.spyOn(repository, 'findAll').mockResolvedValue(tenants);

    const result = await getTenantsUseCase.execute();

    expect(repository.findAll).toHaveBeenCalled();
    expect(result).toEqual(tenants);
  });

  it('deve retornar o tenant quando o id existir', async () => {
    const tenant = { id: 'tenant-1', name: 'Clinica Vida' };

    jest.spyOn(repository, 'findById').mockResolvedValue(tenant);

    const result = await getTenantByIdUseCase.execute('tenant-1');

    expect(repository.findById).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual(tenant);
  });

  it('deve lançar NotFoundException quando o tenant não existir', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(getTenantByIdUseCase.execute('tenant-inexistente')).rejects.toThrow(NotFoundException);
    expect(repository.findById).toHaveBeenCalledWith('tenant-inexistente');
  });
});
