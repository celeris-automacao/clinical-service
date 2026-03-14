import { Test, TestingModule } from '@nestjs/testing';
import { CreateTenantDto } from '../../tenants/dto/create-tenant.dto';
import { CreateTenantUseCase } from '../../tenants/application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from '../../tenants/application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from '../../tenants/application/use-cases/get-tenants.use-case';
import { TenantsController } from '../../tenants/tenants.controller';

describe('TenantsController', () => {
  let controller: TenantsController;
  let createTenantUseCase: CreateTenantUseCase;
  let getTenantsUseCase: GetTenantsUseCase;
  let getTenantByIdUseCase: GetTenantByIdUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: CreateTenantUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' }),
          },
        },
        {
          provide: GetTenantsUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([{ id: 'tenant-1', name: 'Clinica Vida' }]),
          },
        },
        {
          provide: GetTenantByIdUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' }),
          },
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    createTenantUseCase = module.get<CreateTenantUseCase>(CreateTenantUseCase);
    getTenantsUseCase = module.get<GetTenantsUseCase>(GetTenantsUseCase);
    getTenantByIdUseCase = module.get<GetTenantByIdUseCase>(GetTenantByIdUseCase);
  });

  it('deve chamar o use case de criação com o dto informado', async () => {
    const dto: CreateTenantDto = { name: 'Clinica Vida' };

    await controller.create(dto);

    expect(createTenantUseCase.execute).toHaveBeenCalledWith(dto);
  });

  it('deve chamar o use case de listagem ao listar clínicas', async () => {
    const result = await controller.findAll();

    expect(getTenantsUseCase.execute).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'tenant-1', name: 'Clinica Vida' }]);
  });

  it('deve chamar o use case de busca por id com o parâmetro recebido na rota', async () => {
    const tenantId = 'tenant-1';

    await controller.findOne(tenantId);

    expect(getTenantByIdUseCase.execute).toHaveBeenCalledWith(tenantId);
  });
});
