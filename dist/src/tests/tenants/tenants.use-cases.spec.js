"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const create_tenant_use_case_1 = require("../../tenants/application/use-cases/create-tenant.use-case");
const get_tenant_by_id_use_case_1 = require("../../tenants/application/use-cases/get-tenant-by-id.use-case");
const get_tenants_use_case_1 = require("../../tenants/application/use-cases/get-tenants.use-case");
const tenants_tokens_1 = require("../../tenants/tenants.tokens");
describe('Tenants Use Cases', () => {
    let repository;
    let createTenantUseCase;
    let getTenantsUseCase;
    let getTenantByIdUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                create_tenant_use_case_1.CreateTenantUseCase,
                get_tenants_use_case_1.GetTenantsUseCase,
                get_tenant_by_id_use_case_1.GetTenantByIdUseCase,
                {
                    provide: tenants_tokens_1.TENANTS_REPOSITORY,
                    useValue: {
                        create: jest.fn(),
                        findAll: jest.fn(),
                        findById: jest.fn(),
                    },
                },
            ],
        }).compile();
        repository = module.get(tenants_tokens_1.TENANTS_REPOSITORY);
        createTenantUseCase = module.get(create_tenant_use_case_1.CreateTenantUseCase);
        getTenantsUseCase = module.get(get_tenants_use_case_1.GetTenantsUseCase);
        getTenantByIdUseCase = module.get(get_tenant_by_id_use_case_1.GetTenantByIdUseCase);
    });
    it('deve delegar a criação do tenant para o repositório', async () => {
        const dto = { name: 'Clinica Vida' };
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
        await expect(getTenantByIdUseCase.execute('tenant-inexistente')).rejects.toThrow(common_1.NotFoundException);
        expect(repository.findById).toHaveBeenCalledWith('tenant-inexistente');
    });
});
//# sourceMappingURL=tenants.use-cases.spec.js.map