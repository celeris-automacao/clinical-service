"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const change_tenant_status_use_case_1 = require("../../tenants/application/use-cases/change-tenant-status.use-case");
const create_tenant_use_case_1 = require("../../tenants/application/use-cases/create-tenant.use-case");
const get_tenant_by_id_use_case_1 = require("../../tenants/application/use-cases/get-tenant-by-id.use-case");
const get_tenants_use_case_1 = require("../../tenants/application/use-cases/get-tenants.use-case");
const tenants_tokens_1 = require("../../tenants/tenants.tokens");
describe('Tenants Use Cases', () => {
    let repository;
    let createTenantUseCase;
    let getTenantsUseCase;
    let getTenantByIdUseCase;
    let changeTenantStatusUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                create_tenant_use_case_1.CreateTenantUseCase,
                get_tenants_use_case_1.GetTenantsUseCase,
                get_tenant_by_id_use_case_1.GetTenantByIdUseCase,
                change_tenant_status_use_case_1.ChangeTenantStatusUseCase,
                {
                    provide: tenants_tokens_1.TENANTS_REPOSITORY,
                    useValue: {
                        create: jest.fn(),
                        findAll: jest.fn(),
                        findById: jest.fn(),
                        findByCnpj: jest.fn(),
                        findActivePlanById: jest.fn(),
                        updateStatus: jest.fn(),
                    },
                },
            ],
        }).compile();
        repository = module.get(tenants_tokens_1.TENANTS_REPOSITORY);
        createTenantUseCase = module.get(create_tenant_use_case_1.CreateTenantUseCase);
        getTenantsUseCase = module.get(get_tenants_use_case_1.GetTenantsUseCase);
        getTenantByIdUseCase = module.get(get_tenant_by_id_use_case_1.GetTenantByIdUseCase);
        changeTenantStatusUseCase = module.get(change_tenant_status_use_case_1.ChangeTenantStatusUseCase);
    });
    it('deve delegar a criacao do tenant para o repositorio quando CNPJ e plano forem validos', async () => {
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
        const createdTenant = { id: 'tenant-1', name: dto.name };
        jest.spyOn(repository, 'findByCnpj').mockResolvedValue(null);
        jest.spyOn(repository, 'findActivePlanById').mockResolvedValue({ id: 'plan-1' });
        jest.spyOn(repository, 'create').mockResolvedValue(createdTenant);
        const result = await createTenantUseCase.execute(dto);
        expect(repository.create).toHaveBeenCalledWith(dto);
        expect(result).toEqual(createdTenant);
    });
    it('deve impedir criacao com CNPJ duplicado', async () => {
        jest.spyOn(repository, 'findByCnpj').mockResolvedValue({ id: 'tenant-1' });
        jest.spyOn(repository, 'findActivePlanById').mockResolvedValue({ id: 'plan-1' });
        await expect(createTenantUseCase.execute({
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
        })).rejects.toThrow(new common_1.BadRequestException('Ja existe uma clinica cadastrada com este CNPJ.'));
    });
    it('deve listar todos os tenants usando o repositorio', async () => {
        jest.spyOn(repository, 'findAll').mockResolvedValue([{ id: 'tenant-1', name: 'Clinica Vida' }]);
        const result = await getTenantsUseCase.execute();
        expect(result).toHaveLength(1);
    });
    it('deve retornar o tenant quando o id existir', async () => {
        jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'tenant-1', name: 'Clinica Vida' });
        const result = await getTenantByIdUseCase.execute('tenant-1');
        expect(result.id).toBe('tenant-1');
    });
    it('deve lancar NotFoundException quando o tenant nao existir', async () => {
        jest.spyOn(repository, 'findById').mockResolvedValue(null);
        await expect(getTenantByIdUseCase.execute('tenant-inexistente')).rejects.toThrow(common_1.NotFoundException);
    });
    it('deve alterar o status de um tenant existente', async () => {
        jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'tenant-1' });
        jest.spyOn(repository, 'updateStatus').mockResolvedValue({ id: 'tenant-1', status: 'inactive' });
        const result = await changeTenantStatusUseCase.execute('tenant-1', 'inactive');
        expect(repository.updateStatus).toHaveBeenCalledWith('tenant-1', 'inactive');
        expect(result.status).toBe('inactive');
    });
});
//# sourceMappingURL=tenants.use-cases.spec.js.map