"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const create_plan_use_case_1 = require("../../plans/application/use-cases/create-plan.use-case");
const get_plan_by_id_use_case_1 = require("../../plans/application/use-cases/get-plan-by-id.use-case");
const get_plans_use_case_1 = require("../../plans/application/use-cases/get-plans.use-case");
const plans_tokens_1 = require("../../plans/plans.tokens");
describe('Plans Use Cases', () => {
    let repository;
    let createPlanUseCase;
    let getPlansUseCase;
    let getPlanByIdUseCase;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                create_plan_use_case_1.CreatePlanUseCase,
                get_plans_use_case_1.GetPlansUseCase,
                get_plan_by_id_use_case_1.GetPlanByIdUseCase,
                {
                    provide: plans_tokens_1.PLANS_REPOSITORY,
                    useValue: {
                        create: jest.fn(),
                        findAll: jest.fn(),
                        findById: jest.fn(),
                        findByCode: jest.fn(),
                    },
                },
            ],
        }).compile();
        repository = module.get(plans_tokens_1.PLANS_REPOSITORY);
        createPlanUseCase = module.get(create_plan_use_case_1.CreatePlanUseCase);
        getPlansUseCase = module.get(get_plans_use_case_1.GetPlansUseCase);
        getPlanByIdUseCase = module.get(get_plan_by_id_use_case_1.GetPlanByIdUseCase);
    });
    it('deve criar plano quando o codigo for unico', async () => {
        jest.spyOn(repository, 'findByCode').mockResolvedValue(null);
        jest.spyOn(repository, 'create').mockResolvedValue({ id: 'plan-1' });
        const result = await createPlanUseCase.execute({
            name: 'Starter',
            code: 'starter',
            maxStaff: 10,
            maxPatients: 100,
            monthlyPrice: 299,
        });
        expect(result.id).toBe('plan-1');
    });
    it('deve impedir criacao de plano com codigo duplicado', async () => {
        jest.spyOn(repository, 'findByCode').mockResolvedValue({ id: 'plan-1' });
        await expect(createPlanUseCase.execute({
            name: 'Starter',
            code: 'starter',
            maxStaff: 10,
            maxPatients: 100,
            monthlyPrice: 299,
        })).rejects.toThrow(new common_1.BadRequestException('Ja existe um plano com este codigo.'));
    });
    it('deve listar planos ativos', async () => {
        jest.spyOn(repository, 'findAll').mockResolvedValue([{ id: 'plan-1' }]);
        const result = await getPlansUseCase.execute();
        expect(result).toHaveLength(1);
    });
    it('deve buscar plano por id', async () => {
        jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'plan-1' });
        const result = await getPlanByIdUseCase.execute('plan-1');
        expect(result.id).toBe('plan-1');
    });
    it('deve lancar erro quando o plano nao existir', async () => {
        jest.spyOn(repository, 'findById').mockResolvedValue(null);
        await expect(getPlanByIdUseCase.execute('plan-404')).rejects.toThrow(new common_1.NotFoundException('Plano nao encontrado.'));
    });
});
//# sourceMappingURL=plans.use-cases.spec.js.map