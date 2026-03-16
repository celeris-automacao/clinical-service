"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const create_tenant_use_case_1 = require("../../tenants/application/use-cases/create-tenant.use-case");
const get_tenant_by_id_use_case_1 = require("../../tenants/application/use-cases/get-tenant-by-id.use-case");
const get_tenants_use_case_1 = require("../../tenants/application/use-cases/get-tenants.use-case");
const tenants_controller_1 = require("../../tenants/presentation/http/tenants.controller");
describe('TenantsController', () => {
    let controller;
    let createTenantUseCase;
    let getTenantsUseCase;
    let getTenantByIdUseCase;
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
            ],
        }).compile();
        controller = module.get(tenants_controller_1.TenantsController);
        createTenantUseCase = module.get(create_tenant_use_case_1.CreateTenantUseCase);
        getTenantsUseCase = module.get(get_tenants_use_case_1.GetTenantsUseCase);
        getTenantByIdUseCase = module.get(get_tenant_by_id_use_case_1.GetTenantByIdUseCase);
    });
    it('deve chamar o use case de criação com o dto informado', async () => {
        const dto = { name: 'Clinica Vida' };
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
//# sourceMappingURL=tenants.controller.spec.js.map