import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateTenantDto } from '../../tenants/dto/create-tenant.dto';
import { ITenantsRepository } from '../../tenants/repositories/interfaces/tenants-repository.interface';
import { TenantsService } from '../../tenants/tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: ITenantsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: 'ITenantsRepository',
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    repository = module.get<ITenantsRepository>('ITenantsRepository');
  });

  it('deve delegar a criacao do tenant para o repositorio', async () => {
    const dto: CreateTenantDto = { name: 'Clinica Vida' };
    const createdTenant = { id: 'tenant-1', name: dto.name };

    jest.spyOn(repository, 'create').mockResolvedValue(createdTenant as any);

    const result = await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdTenant);
  });

  it('deve listar todos os tenants usando o repositorio', async () => {
    const tenants = [{ id: 'tenant-1', name: 'Clinica Vida' }];

    jest.spyOn(repository, 'findAll').mockResolvedValue(tenants as any);

    const result = await service.findAll();

    expect(repository.findAll).toHaveBeenCalled();
    expect(result).toEqual(tenants);
  });

  it('deve retornar o tenant quando o id existir', async () => {
    const tenant = { id: 'tenant-1', name: 'Clinica Vida' };

    jest.spyOn(repository, 'findById').mockResolvedValue(tenant as any);

    const result = await service.findOne('tenant-1');

    expect(repository.findById).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual(tenant);
  });

  it('deve lancar NotFoundException quando o tenant nao existir', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(service.findOne('tenant-inexistente')).rejects.toThrow(NotFoundException);
    expect(repository.findById).toHaveBeenCalledWith('tenant-inexistente');
  });
});
