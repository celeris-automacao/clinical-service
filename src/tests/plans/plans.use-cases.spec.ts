import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePlanUseCase } from '../../plans/application/use-cases/create-plan.use-case';
import { GetPlanByIdUseCase } from '../../plans/application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from '../../plans/application/use-cases/get-plans.use-case';
import { PlansRepositoryPort } from '../../plans/application/ports/plans-repository.port';
import { PLANS_REPOSITORY } from '../../plans/plans.tokens';

describe('Plans Use Cases', () => {
  let repository: PlansRepositoryPort;
  let createPlanUseCase: CreatePlanUseCase;
  let getPlansUseCase: GetPlansUseCase;
  let getPlanByIdUseCase: GetPlanByIdUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePlanUseCase,
        GetPlansUseCase,
        GetPlanByIdUseCase,
        {
          provide: PLANS_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            findByCode: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<PlansRepositoryPort>(PLANS_REPOSITORY);
    createPlanUseCase = module.get<CreatePlanUseCase>(CreatePlanUseCase);
    getPlansUseCase = module.get<GetPlansUseCase>(GetPlansUseCase);
    getPlanByIdUseCase = module.get<GetPlanByIdUseCase>(GetPlanByIdUseCase);
  });

  it('deve criar plano quando o codigo for unico', async () => {
    jest.spyOn(repository, 'findByCode').mockResolvedValue(null);
    jest.spyOn(repository, 'create').mockResolvedValue({ id: 'plan-1' } as any);

    const result = await createPlanUseCase.execute({
      name: 'Starter',
      code: 'starter',
      maxStaff: 10,
      maxPatients: 100,
      monthlyPrice: 299,
    } as any);

    expect(result.id).toBe('plan-1');
  });

  it('deve impedir criacao de plano com codigo duplicado', async () => {
    jest.spyOn(repository, 'findByCode').mockResolvedValue({ id: 'plan-1' } as any);

    await expect(
      createPlanUseCase.execute({
        name: 'Starter',
        code: 'starter',
        maxStaff: 10,
        maxPatients: 100,
        monthlyPrice: 299,
      } as any),
    ).rejects.toThrow(new BadRequestException('Ja existe um plano com este codigo.'));
  });

  it('deve listar planos ativos', async () => {
    jest.spyOn(repository, 'findAll').mockResolvedValue([{ id: 'plan-1' }] as any);

    const result = await getPlansUseCase.execute();

    expect(result).toHaveLength(1);
  });

  it('deve buscar plano por id', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'plan-1' } as any);

    const result = await getPlanByIdUseCase.execute('plan-1');

    expect(result.id).toBe('plan-1');
  });

  it('deve lancar erro quando o plano nao existir', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(getPlanByIdUseCase.execute('plan-404')).rejects.toThrow(
      new NotFoundException('Plano nao encontrado.'),
    );
  });
});
