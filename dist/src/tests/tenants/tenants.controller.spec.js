"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const tenants_controller_1 = require("../../tenants/tenants.controller");
const tenants_service_1 = require("../../tenants/tenants.service");
describe('TenantsController', () => {
    let controller;
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [tenants_controller_1.TenantsController],
            providers: [
                {
                    provide: tenants_service_1.TenantsService,
                    useValue: {
                        create: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' }),
                        findAll: jest.fn().mockResolvedValue([{ id: 'tenant-1', name: 'Clinica Vida' }]),
                        findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' }),
                    },
                },
            ],
        }).compile();
        controller = module.get(tenants_controller_1.TenantsController);
        service = module.get(tenants_service_1.TenantsService);
    });
    it('deve chamar o service.create com o dto informado', async () => {
        const dto = { name: 'Clinica Vida' };
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
//# sourceMappingURL=tenants.controller.spec.js.map