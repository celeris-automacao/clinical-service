import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePlanUseCase } from '../../plans/application/use-cases/create-plan.use-case';
import { GetPlanByIdUseCase } from '../../plans/application/use-cases/get-plan-by-id.use-case';
import { CreatePlanUpgradeRequestUseCase } from '../../plans/application/use-cases/create-plan-upgrade-request.use-case';
import { GetPendingPlanUpgradeRequestUseCase } from '../../plans/application/use-cases/get-pending-plan-upgrade-request.use-case';
import { GetPlansUseCase } from '../../plans/application/use-cases/get-plans.use-case';
import { PlansRepositoryPort } from '../../plans/application/ports/plans-repository.port';
import { PLANS_REPOSITORY } from '../../plans/plans.tokens';

describe('Plans Use Cases', () => {
  let repository: PlansRepositoryPort;
  let createPlanUseCase: CreatePlanUseCase;
  let getPlansUseCase: GetPlansUseCase;
  let getPlanByIdUseCase: GetPlanByIdUseCase;
  let createPlanUpgradeRequestUseCase: CreatePlanUpgradeRequestUseCase;
  let getPendingPlanUpgradeRequestUseCase: GetPendingPlanUpgradeRequestUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePlanUseCase,
        GetPlansUseCase,
        GetPlanByIdUseCase,
        CreatePlanUpgradeRequestUseCase,
        GetPendingPlanUpgradeRequestUseCase,
        {
          provide: PLANS_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            findByCode: jest.fn(),
            findTenantCurrentPlanId: jest.fn(),
            findPendingUpgradeRequest: jest.fn(),
            createUpgradeRequest: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<PlansRepositoryPort>(PLANS_REPOSITORY);
    createPlanUseCase = module.get<CreatePlanUseCase>(CreatePlanUseCase);
    getPlansUseCase = module.get<GetPlansUseCase>(GetPlansUseCase);
    getPlanByIdUseCase = module.get<GetPlanByIdUseCase>(GetPlanByIdUseCase);
    createPlanUpgradeRequestUseCase = module.get<CreatePlanUpgradeRequestUseCase>(
      CreatePlanUpgradeRequestUseCase,
    );
    getPendingPlanUpgradeRequestUseCase =
      module.get<GetPendingPlanUpgradeRequestUseCase>(
        GetPendingPlanUpgradeRequestUseCase,
      );
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

  it('deve retornar a solicitacao pendente da clinica', async () => {
    const pendingRequest = { id: 'request-1', status: 'pending' };
    jest
      .spyOn(repository, 'findPendingUpgradeRequest')
      .mockResolvedValue(pendingRequest);

    await expect(
      getPendingPlanUpgradeRequestUseCase.execute('tenant-1'),
    ).resolves.toBe(pendingRequest);
    expect(repository.findPendingUpgradeRequest).toHaveBeenCalledWith(
      'tenant-1',
    );
  });

  it('deve criar solicitacao de mudanca para um plano ativo', async () => {
    const request = { id: 'request-1', status: 'pending' };
    jest.spyOn(repository, 'findPendingUpgradeRequest').mockResolvedValue(null);
    jest
      .spyOn(repository, 'findTenantCurrentPlanId')
      .mockResolvedValue('current-plan');
    jest
      .spyOn(repository, 'findById')
      .mockResolvedValue({ id: 'target-plan', isActive: true });
    jest
      .spyOn(repository, 'createUpgradeRequest')
      .mockResolvedValue(request);

    await expect(
      createPlanUpgradeRequestUseCase.execute(
        'tenant-1',
        'user-1',
        'target-plan',
      ),
    ).resolves.toBe(request);
    expect(repository.createUpgradeRequest).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      currentPlanId: 'current-plan',
      targetPlanId: 'target-plan',
      requestedByUserId: 'user-1',
    });
  });

  it('deve impedir mais de uma solicitacao pendente por clinica', async () => {
    jest
      .spyOn(repository, 'findPendingUpgradeRequest')
      .mockResolvedValue({ id: 'request-1' });

    await expect(
      createPlanUpgradeRequestUseCase.execute(
        'tenant-1',
        'user-1',
        'target-plan',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'A clinica ja possui uma solicitacao de plano pendente.',
      ),
    );
    expect(repository.createUpgradeRequest).not.toHaveBeenCalled();
  });
});
