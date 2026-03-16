import { Test, TestingModule } from '@nestjs/testing';
import { ChangeTenantStatusUseCase } from '../../tenants/application/use-cases/change-tenant-status.use-case';
import { CreateTenantUseCase } from '../../tenants/application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from '../../tenants/application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from '../../tenants/application/use-cases/get-tenants.use-case';
import { CreateTenantDto } from '../../tenants/presentation/http/dto/create-tenant.dto';
import { TenantsController } from '../../tenants/presentation/http/tenants.controller';

describe('TenantsController', () => {
  let controller: TenantsController;
  let createTenantUseCase: CreateTenantUseCase;
  let getTenantsUseCase: GetTenantsUseCase;
  let getTenantByIdUseCase: GetTenantByIdUseCase;
  let changeTenantStatusUseCase: ChangeTenantStatusUseCase;

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
        {
          provide: ChangeTenantStatusUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: 'tenant-1', status: 'inactive' }),
          },
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    createTenantUseCase = module.get<CreateTenantUseCase>(CreateTenantUseCase);
    getTenantsUseCase = module.get<GetTenantsUseCase>(GetTenantsUseCase);
    getTenantByIdUseCase = module.get<GetTenantByIdUseCase>(GetTenantByIdUseCase);
    changeTenantStatusUseCase = module.get<ChangeTenantStatusUseCase>(ChangeTenantStatusUseCase);
  });

  it('deve chamar o use case de criacao com o dto informado', async () => {
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

    await controller.create(dto);

    expect(createTenantUseCase.execute).toHaveBeenCalledWith(dto);
  });

  it('deve chamar o use case de listagem ao listar clinicas', async () => {
    const result = await controller.findAll();

    expect(getTenantsUseCase.execute).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'tenant-1', name: 'Clinica Vida' }]);
  });

  it('deve chamar o use case de busca por id com o parametro recebido na rota', async () => {
    await controller.findOne('tenant-1');

    expect(getTenantByIdUseCase.execute).toHaveBeenCalledWith('tenant-1');
  });

  it('deve alterar o status operacional da clinica', async () => {
    await controller.changeStatus('tenant-1', { status: 'inactive' });

    expect(changeTenantStatusUseCase.execute).toHaveBeenCalledWith('tenant-1', 'inactive');
  });
});
