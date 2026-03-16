import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RecordsRepositoryPort } from '../../records/application/ports/records-repository.port';
import { RECORDS_REPOSITORY } from '../../records/records.tokens';
import { AssignTaskTemplateUseCase } from '../../tasks/application/use-cases/assign-task-template.use-case';
import { CreateTaskTemplateUseCase } from '../../tasks/application/use-cases/create-task-template.use-case';
import { GetCategorizedRankingUseCase } from '../../tasks/application/use-cases/get-categorized-ranking.use-case';
import { GetDailyTasksUseCase } from '../../tasks/application/use-cases/get-daily-tasks.use-case';
import { GetRankingUseCase } from '../../tasks/application/use-cases/get-ranking.use-case';
import { GetTasksTodayUseCase } from '../../tasks/application/use-cases/get-tasks-today.use-case';
import { ListTaskTemplatesUseCase } from '../../tasks/application/use-cases/list-task-templates.use-case';
import { TasksRepositoryPort } from '../../tasks/application/ports/tasks-repository.port';
import { TASKS_REPOSITORY } from '../../tasks/tasks.tokens';

describe('Tasks Query Use Cases', () => {
  let tasksRepository: TasksRepositoryPort;
  let recordsRepository: RecordsRepositoryPort;
  let createTaskTemplateUseCase: CreateTaskTemplateUseCase;
  let assignTaskTemplateUseCase: AssignTaskTemplateUseCase;
  let listTaskTemplatesUseCase: ListTaskTemplatesUseCase;
  let getDailyTasksUseCase: GetDailyTasksUseCase;
  let getRankingUseCase: GetRankingUseCase;
  let getCategorizedRankingUseCase: GetCategorizedRankingUseCase;
  let getTasksTodayUseCase: GetTasksTodayUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTaskTemplateUseCase,
        AssignTaskTemplateUseCase,
        ListTaskTemplatesUseCase,
        GetDailyTasksUseCase,
        GetRankingUseCase,
        GetCategorizedRankingUseCase,
        GetTasksTodayUseCase,
        {
          provide: TASKS_REPOSITORY,
          useValue: {
            createTemplate: jest.fn(),
            findTemplateByTitleAndType: jest.fn(),
            findTemplateById: jest.fn(),
            listTemplatesByTenant: jest.fn(),
            createAssignment: jest.fn(),
            findAssignmentsByPatient: jest.fn(),
            findAssignmentsByPatientOnDate: jest.fn(),
            findAssignmentById: jest.fn(),
            findPatientById: jest.fn(),
            findActiveAssignment: jest.fn(),
            findPendingTasksToday: jest.fn(),
            getPlayerStatsRanking: jest.fn(),
            findPatientsWithActivity: jest.fn(),
          },
        },
        {
          provide: RECORDS_REPOSITORY,
          useValue: {
            getClinicalDamageByTenant: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();

    tasksRepository = module.get<TasksRepositoryPort>(TASKS_REPOSITORY);
    recordsRepository = module.get<RecordsRepositoryPort>(RECORDS_REPOSITORY);
    createTaskTemplateUseCase = module.get<CreateTaskTemplateUseCase>(CreateTaskTemplateUseCase);
    assignTaskTemplateUseCase = module.get<AssignTaskTemplateUseCase>(AssignTaskTemplateUseCase);
    listTaskTemplatesUseCase = module.get<ListTaskTemplatesUseCase>(ListTaskTemplatesUseCase);
    getDailyTasksUseCase = module.get<GetDailyTasksUseCase>(GetDailyTasksUseCase);
    getRankingUseCase = module.get<GetRankingUseCase>(GetRankingUseCase);
    getCategorizedRankingUseCase = module.get<GetCategorizedRankingUseCase>(GetCategorizedRankingUseCase);
    getTasksTodayUseCase = module.get<GetTasksTodayUseCase>(GetTasksTodayUseCase);
  });

  it('deve criar template quando nao houver duplicidade no tenant', async () => {
    jest.spyOn(tasksRepository, 'findTemplateByTitleAndType').mockResolvedValue(null);
    jest.spyOn(tasksRepository, 'createTemplate').mockResolvedValue({ id: 'template-1' } as any);

    const result = await createTaskTemplateUseCase.execute(
      {
        title: 'Beber 2L de agua',
        taskType: 'water',
        xpReward: 100,
      } as any,
      't1',
      'staff-1',
    );

    expect(tasksRepository.createTemplate).toHaveBeenCalledWith({
      title: 'Beber 2L de agua',
      taskType: 'water',
      xpReward: 100,
      tenantId: 't1',
      createdByUserId: 'staff-1',
    });
    expect(result).toEqual({ id: 'template-1' });
  });

  it('deve impedir template duplicado por titulo e tipo', async () => {
    jest.spyOn(tasksRepository, 'findTemplateByTitleAndType').mockResolvedValue({ id: 'existing' } as any);

    await expect(
      createTaskTemplateUseCase.execute(
        {
          title: 'Beber 2L de agua',
          taskType: 'water',
          xpReward: 100,
        } as any,
        't1',
        'staff-1',
      ),
    ).rejects.toThrow(new BadRequestException('Ja existe um template de tarefa com esse titulo e tipo.'));
  });

  it('deve listar templates do tenant', async () => {
    jest.spyOn(tasksRepository, 'listTemplatesByTenant').mockResolvedValue([{ id: 'template-1' }] as any);

    const result = await listTaskTemplatesUseCase.execute('t1');

    expect(tasksRepository.listTemplatesByTenant).toHaveBeenCalledWith('t1');
    expect(result).toHaveLength(1);
  });

  it('deve atribuir template valido a um paciente do tenant', async () => {
    jest.spyOn(tasksRepository, 'findTemplateById').mockResolvedValue({ id: 'template-1', isActive: true } as any);
    jest.spyOn(tasksRepository, 'findPatientById').mockResolvedValue({ id: 'patient-1' });
    jest.spyOn(tasksRepository, 'findActiveAssignment').mockResolvedValue(null);
    jest.spyOn(tasksRepository, 'createAssignment').mockResolvedValue({ id: 'assignment-1' } as any);

    const result = await assignTaskTemplateUseCase.execute(
      {
        templateId: 'template-1',
        patientId: 'patient-1',
        dueDate: '2026-03-20',
      } as any,
      't1',
      'staff-1',
    );

    expect(tasksRepository.createAssignment).toHaveBeenCalledWith({
      templateId: 'template-1',
      patientId: 'patient-1',
      tenantId: 't1',
      dueDate: expect.any(Date),
      assignedByUserId: 'staff-1',
    });
    expect(result).toEqual({ id: 'assignment-1' });
  });

  it('deve falhar quando o template nao existir', async () => {
    jest.spyOn(tasksRepository, 'findTemplateById').mockResolvedValue(null);
    jest.spyOn(tasksRepository, 'findPatientById').mockResolvedValue({ id: 'patient-1' });

    await expect(
      assignTaskTemplateUseCase.execute(
        {
          templateId: 'template-1',
          patientId: 'patient-1',
          dueDate: '2026-03-20',
        } as any,
        't1',
        'staff-1',
      ),
    ).rejects.toThrow(new NotFoundException('Template de tarefa nao encontrado.'));
  });

  it('deve listar atribuicoes do paciente', async () => {
    const mockUser = { userId: 'u1', tenantId: 't1' };
    jest.spyOn(tasksRepository, 'findAssignmentsByPatient').mockResolvedValue([{ id: 'assignment-1' }] as any);

    const result = await getDailyTasksUseCase.execute(mockUser as any);

    expect(tasksRepository.findAssignmentsByPatient).toHaveBeenCalledWith('u1', 't1');
    expect(result).toHaveLength(1);
  });

  it('deve mapear corretamente o ranking global e atribuir posicoes', async () => {
    const mockUser = { tenantId: 'tenant-123' };
    const mockPlayerStats = [
      {
        patient: { name: 'Joao Silva' },
        currentLevel: 10,
        currentXp: 500,
        totalDamageDealt: 15000,
      },
      {
        patient: null,
        currentLevel: 5,
        currentXp: 100,
        totalDamageDealt: 5000,
      },
    ];

    jest.spyOn(tasksRepository, 'getPlayerStatsRanking').mockResolvedValue(mockPlayerStats as any);

    const result = await getRankingUseCase.execute(mockUser as any);

    expect(result[0].position).toBe(1);
    expect(result[0].name).toBe('Joao Silva');
    expect(result[1].name).toBe('Herói Anônimo');
  });

  it('deve retornar o ranking categorizado integrando dano de tarefas e clinico', async () => {
    const tenantId = 't1';
    const mockPatients = [
      { id: 'p1', name: 'Paciente A', taskAssignments: [{ template: { xpReward: 1000 } }] },
    ];
    const mockClinicalDamageMap = new Map<string, number>();
    mockClinicalDamageMap.set('p1', 7700);

    jest.spyOn(tasksRepository, 'findPatientsWithActivity').mockResolvedValue(mockPatients as any);
    jest.spyOn(recordsRepository, 'getClinicalDamageByTenant').mockResolvedValue(mockClinicalDamageMap);

    const result = await getCategorizedRankingUseCase.execute(tenantId);

    expect(result[0].missionRank).toBe(1000);
    expect(result[0].clinicalRank).toBe(7700);
    expect(result[0].totalDamage).toBe(8700);
  });

  it('deve buscar as tarefas pendentes de hoje com as horas resetadas para meia-noite', async () => {
    const mockUser = { userId: 'user-789', tenantId: 'tenant-456' };
    jest.spyOn(tasksRepository, 'findPendingTasksToday').mockResolvedValue([{ id: 'a1' }] as any);

    const result = await getTasksTodayUseCase.execute(mockUser as any);

    const expectedDate = new Date();
    expectedDate.setHours(0, 0, 0, 0);

    expect(tasksRepository.findPendingTasksToday).toHaveBeenCalledWith(
      mockUser.userId,
      mockUser.tenantId,
      expectedDate,
    );
    expect(result).toHaveLength(1);
  });
});
