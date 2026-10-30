import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChangeTenantStatusUseCase } from '../../tenants/application/use-cases/change-tenant-status.use-case';
import { CreateTenantUseCase } from '../../tenants/application/use-cases/create-tenant.use-case';
import { GetTenantByIdUseCase } from '../../tenants/application/use-cases/get-tenant-by-id.use-case';
import { GetTenantsUseCase } from '../../tenants/application/use-cases/get-tenants.use-case';
import { UpdateTenantContactEmailUseCase } from '../../tenants/application/use-cases/update-tenant-contact-email.use-case';
import { TenantsRepositoryPort } from '../../tenants/application/ports/tenants-repository.port';
import { CreateTenantDto } from '../../tenants/presentation/http/dto/create-tenant.dto';
import { TENANTS_REPOSITORY } from '../../tenants/tenants.tokens';

describe('Tenants Use Cases', () => {
  let repository: TenantsRepositoryPort;
  let createTenantUseCase: CreateTenantUseCase;
  let getTenantsUseCase: GetTenantsUseCase;
  let getTenantByIdUseCase: GetTenantByIdUseCase;
  let changeTenantStatusUseCase: ChangeTenantStatusUseCase;
  let updateTenantContactEmailUseCase: UpdateTenantContactEmailUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTenantUseCase,
        GetTenantsUseCase,
        GetTenantByIdUseCase,
        ChangeTenantStatusUseCase,
        UpdateTenantContactEmailUseCase,
        {
          provide: TENANTS_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            findByCnpj: jest.fn(),
            findActivePlanById: jest.fn(),
            updateStatus: jest.fn(),
            updateResponsibleEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<TenantsRepositoryPort>(TENANTS_REPOSITORY);
    createTenantUseCase = module.get<CreateTenantUseCase>(CreateTenantUseCase);
    getTenantsUseCase = module.get<GetTenantsUseCase>(GetTenantsUseCase);
    getTenantByIdUseCase =
      module.get<GetTenantByIdUseCase>(GetTenantByIdUseCase);
    changeTenantStatusUseCase = module.get<ChangeTenantStatusUseCase>(
      ChangeTenantStatusUseCase,
    );
    updateTenantContactEmailUseCase =
      module.get<UpdateTenantContactEmailUseCase>(
        UpdateTenantContactEmailUseCase,
      );
  });

  it('deve delegar a criacao do tenant para o repositorio quando CNPJ e plano forem validos', async () => {
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
    const createdTenant = { id: 'tenant-1', name: dto.name };

    jest.spyOn(repository, 'findByCnpj').mockResolvedValue(null);
    jest
      .spyOn(repository, 'findActivePlanById')
      .mockResolvedValue({ id: 'plan-1' });
    jest.spyOn(repository, 'create').mockResolvedValue(createdTenant);

    const result = await createTenantUseCase.execute(dto);

    expect(repository.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(createdTenant);
  });

  it('deve impedir criacao com CNPJ duplicado', async () => {
    jest.spyOn(repository, 'findByCnpj').mockResolvedValue({ id: 'tenant-1' });
    jest
      .spyOn(repository, 'findActivePlanById')
      .mockResolvedValue({ id: 'plan-1' });

    await expect(
      createTenantUseCase.execute({
        name: 'Clinica Vida',
        legalName: 'Clinica Vida LTDA',
        cnpj: '12345678000199',
        planId: 'plan-1',
        responsibleName: 'Helena Costa',
        responsibleEmail: 'owner@clinica.com',
        address: {
          zipCode: '01311000',
          street: 'Av Paulista',
          number: '1000',
          neighborhood: 'Bela Vista',
          city: 'Sao Paulo',
          state: 'SP',
        },
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Ja existe uma clinica cadastrada com este CNPJ.',
      ),
    );
  });

  it('deve listar todos os tenants usando o repositorio', async () => {
    jest
      .spyOn(repository, 'findAll')
      .mockResolvedValue([{ id: 'tenant-1', name: 'Clinica Vida' }]);

    const result = await getTenantsUseCase.execute();

    expect(result).toHaveLength(1);
  });

  it('deve retornar o tenant quando o id existir', async () => {
    jest
      .spyOn(repository, 'findById')
      .mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' });

    const result = await getTenantByIdUseCase.execute('tenant-1');

    expect(result.id).toBe('tenant-1');
  });

  it('deve lancar NotFoundException quando o tenant nao existir', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(
      getTenantByIdUseCase.execute('tenant-inexistente'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deve alterar o status de um tenant existente', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'tenant-1' });
    jest
      .spyOn(repository, 'updateStatus')
      .mockResolvedValue({ id: 'tenant-1', status: 'inactive' });

    const result = await changeTenantStatusUseCase.execute(
      'tenant-1',
      'inactive',
    );

    expect(repository.updateStatus).toHaveBeenCalledWith(
      'tenant-1',
      'inactive',
    );
    expect(result.status).toBe('inactive');
  });

  it('deve permitir editar e-mail de contato apenas da própria clínica', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'tenant-1' });
    jest.spyOn(repository, 'updateResponsibleEmail').mockResolvedValue({
      id: 'tenant-1',
      responsibleEmail: 'novo@clinica.com',
    });

    const result = await updateTenantContactEmailUseCase.execute(
      'tenant-1',
      'novo@clinica.com',
      { tenantId: 'tenant-1', userId: 'owner-1', role: 'owner' },
    );

    expect(repository.findById).toHaveBeenCalledWith('tenant-1');
    expect(repository.updateResponsibleEmail).toHaveBeenCalledWith(
      'tenant-1',
      'novo@clinica.com',
    );
    expect(result.responsibleEmail).toBe('novo@clinica.com');
  });

  it('deve negar alteração do e-mail de outra clínica', async () => {
    await expect(
      updateTenantContactEmailUseCase.execute('tenant-2', 'novo@clinica.com', {
        tenantId: 'tenant-1',
        userId: 'owner-1',
        role: 'owner',
      }),
    ).rejects.toThrow('Sem permissao');
    expect(repository.updateResponsibleEmail).not.toHaveBeenCalled();
  });
});
