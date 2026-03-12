import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from '../../tenants/tenants.controller';
import { TenantsService } from '../../tenants/tenants.service';
import { CreateTenantDto } from '../../tenants/dto/create-tenant.dto';

describe('TenantsController', () => {
  let controller: TenantsController;
  let service: TenantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' }),
            findAll: jest.fn().mockResolvedValue([{ id: 'tenant-1', name: 'Clinica Vida' }]),
            findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' }),
          },
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    service = module.get<TenantsService>(TenantsService);
  });

  it('deve chamar o service.create com o dto informado', async () => {
    const dto: CreateTenantDto = { name: 'Clinica Vida' };

    await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('deve chamar o service.findAll ao listar clinicas', async () => {
    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'tenant-1', name: 'Clinica Vida' }]);
  });

  it('deve chamar o service.findOne com o id recebido na rota', async () => {
    const tenantId = 'tenant-1';

    await controller.findOne(tenantId);

    expect(service.findOne).toHaveBeenCalledWith(tenantId);
  });
});
