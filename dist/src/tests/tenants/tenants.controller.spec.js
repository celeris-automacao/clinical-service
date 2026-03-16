"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const change_tenant_status_use_case_1 = require("../../tenants/application/use-cases/change-tenant-status.use-case");
const create_tenant_use_case_1 = require("../../tenants/application/use-cases/create-tenant.use-case");
const get_tenant_by_id_use_case_1 = require("../../tenants/application/use-cases/get-tenant-by-id.use-case");
const get_tenants_use_case_1 = require("../../tenants/application/use-cases/get-tenants.use-case");
const tenants_controller_1 = require("../../tenants/presentation/http/tenants.controller");
describe('TenantsController', () => {
    let controller;
    let createTenantUseCase;
    let getTenantsUseCase;
    let getTenantByIdUseCase;
    let changeTenantStatusUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [tenants_controller_1.TenantsController],
            providers: [
                {
                    provide: create_tenant_use_case_1.CreateTenantUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' }),
                    },
                },
                {
                    provide: get_tenants_use_case_1.GetTenantsUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue([{ id: 'tenant-1', name: 'Clinica Vida' }]),
                    },
                },
                {
                    provide: get_tenant_by_id_use_case_1.GetTenantByIdUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' }),
                    },
                },
                {
                    provide: change_tenant_status_use_case_1.ChangeTenantStatusUseCase,
                    useValue: {
                        execute: jest.fn().mockResolvedValue({ id: 'tenant-1', status: 'inactive' }),
                    },
                },
            ],
        }).compile();
        controller = module.get(tenants_controller_1.TenantsController);
        createTenantUseCase = module.get(create_tenant_use_case_1.CreateTenantUseCase);
        getTenantsUseCase = module.get(get_tenants_use_case_1.GetTenantsUseCase);
        getTenantByIdUseCase = module.get(get_tenant_by_id_use_case_1.GetTenantByIdUseCase);
        changeTenantStatusUseCase = module.get(change_tenant_status_use_case_1.ChangeTenantStatusUseCase);
    });
    it('deve chamar o use case de criacao com o dto informado', async () => {
        const dto = {
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
//# sourceMappingURL=tenants.controller.spec.js.map