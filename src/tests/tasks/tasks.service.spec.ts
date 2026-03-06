import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from '../../tasks/tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../../achievements/achievements.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { ITasksRepository } from '../../tasks/repositories/interfaces/tasks.repository.interface';
import { IRecordsRepository } from '../../records/repositories/interfaces/records.repository.interface';
import { RecordsService } from '../../records/records.service'; // Ajuste o caminho se necessário

describe('TasksService', () => {
  let service: TasksService;
  let repository: ITasksRepository;
  let recordsRepository: IRecordsRepository;
  let achievementsService: AchievementsService;
  let prisma: PrismaService;
  let recordsService: RecordsService;

  const mockUser = { userId: 'u1', tenantId: 't1', role: 'patient' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: 'ITasksRepository',
          useValue: {
            findTasksByTenant: jest.fn(),
            findCompletionsByPatientToday: jest.fn(),
            findSpecificCompletionToday: jest.fn(),
            findById: jest.fn(),
            getPlayerStatsRanking: jest.fn(),
            findPendingTasksToday: jest.fn(),
            findPatientsWithActivity: jest.fn(),
          },
        },
        {
          provide: 'IRecordsRepository',
          useValue: {
            getClinicalDamageByTenant: jest.fn().mockResolvedValue(new Map()),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            // Mock base do Prisma fora da transação
            $transaction: jest.fn((cb) => cb({
              taskCompletion: { create: jest.fn() },
              playerStats: {
                upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 50 }),
                update: jest.fn(),
              },
              bossBattle: {
                findFirst: jest.fn().mockResolvedValue({ id: 'boss-1', currentHp: 1000 }),
                update: jest.fn()
              }
            } as any)), // <--- CORREÇÃO 1: 'as any' para satisfazer os tipos do Prisma
            bossBattle: { findFirst: jest.fn() },
          },
        },
        { provide: AchievementsService, useValue: { checkLevelAchievements: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: RecordsService,
          useValue: {
            // CORREÇÃO 2: Nome correto do método (handleBossVictory)
            handleBossVictory: jest.fn().mockResolvedValue({ success: true }),
          }
        }
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get<ITasksRepository>('ITasksRepository');
    recordsRepository = module.get<IRecordsRepository>('IRecordsRepository');
    achievementsService = module.get<AchievementsService>(AchievementsService);
    prisma = module.get<PrismaService>(PrismaService);
    recordsService = module.get<RecordsService>(RecordsService);
  });

  describe('completeTask', () => {
    it('deve lançar erro se a tarefa já foi completada hoje', async () => {
      jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue({ id: 'comp1' } as any);

      await expect(service.completeTask('task1', mockUser as any))
        .rejects.toThrow(BadRequestException);
    });

    it('deve processar a conclusão com sucesso e dar dano no boss', async () => {
      jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue(null);
      jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'task1', xpReward: 50 } as any);

      const result = await service.completeTask('task1', mockUser as any);

      expect(result.success).toBe(true);
      expect(result.xp_earned).toBe(50);
      expect(result.boss_damage).toBe(50);
    });
  });

  describe('getCategorizedRanking', () => {
    it('deve retornar o ranking categorizado integrando dano de tarefas e clínico', async () => {
      const tenantId = 't1';

      const mockPatients = [
        { id: 'p1', name: 'Paciente A', completions: [{ task: { xpReward: 1000 } }] }
      ];

      // Mock do mapa de dano clínico (1kg perdido = 7700 de dano)
      const mockClinicalDamageMap = new Map<string, number>();
      mockClinicalDamageMap.set('p1', 7700);

      jest.spyOn(repository, 'findPatientsWithActivity').mockResolvedValue(mockPatients as any);
      jest.spyOn(recordsRepository, 'getClinicalDamageByTenant').mockResolvedValue(mockClinicalDamageMap);

      const result = await service.getCategorizedRanking(tenantId);

      expect(result[0].name).toBe('Paciente A');
      expect(result[0].missionRank).toBe(1000);
      expect(result[0].clinicalRank).toBe(7700);
      expect(result[0].totalDamage).toBe(8700);
    });
  });

  describe('getRanking', () => {
    it('deve mapear corretamente o ranking global e atribuir posições', async () => {
      const mockUser = { tenantId: 'tenant-123' };
      const mockPlayerStats = [
        {
          patient: { name: 'João Silva' },
          currentLevel: 10,
          currentXp: 500,
          totalDamageDealt: 15000
        },
        {
          patient: null, // Teste do fallback "Herói Anônimo"
          currentLevel: 5,
          currentXp: 100,
          totalDamageDealt: 5000
        }
      ];

      jest.spyOn(repository, 'getPlayerStatsRanking').mockResolvedValue(mockPlayerStats as any);

      const result = await service.getRanking(mockUser as any);

      expect(result).toHaveLength(2);

      // Valida posição 1
      expect(result[0].position).toBe(1);
      expect(result[0].name).toBe('João Silva');

      // Valida posição 2 e fallback de nome
      expect(result[1].position).toBe(2);
      expect(result[1].name).toBe('Herói Anônimo');
      expect(result[1].damage).toBe(5000);
    });
  });
  describe('getTasksToday', () => {
    it('deve buscar as tarefas pendentes de hoje com as horas resetadas para meia-noite', async () => {
      // 1. Setup dos dados de teste
      const mockUser = { userId: 'user-789', tenantId: 'tenant-456' };
      const mockPendingTasks = [
        { id: 'task-1', title: 'Caminhada Matinal', xpReward: 500 },
        { id: 'task-2', title: 'Beber 2L de Água', xpReward: 200 }
      ];

      // 2. Mock do repositório para retornar a lista simulada
      jest.spyOn(repository, 'findPendingTasksToday').mockResolvedValue(mockPendingTasks as any);

      // 3. Execução do método
      const result = await service.getTasksToday(mockUser as any);

      // 4. Verificação da Lógica de Data (Crucial para a cobertura)
      const expectedDate = new Date();
      expectedDate.setHours(0, 0, 0, 0); // O método deve ter resetado as horas exatamente assim

      // Verificamos se o repositório foi chamado com os parâmetros corretos
      expect(repository.findPendingTasksToday).toHaveBeenCalledWith(
        mockUser.userId,
        mockUser.tenantId,
        expectedDate
      );

      // Verificamos se o retorno é a lista de tarefas
      expect(result).toEqual(mockPendingTasks);
      expect(result).toHaveLength(2);
    });
  });
  describe('getDailyTasks', () => {
    it('deve listar as tarefas do tenant e marcar corretamente as que o usuário já completou hoje', async () => {
      const mockUser = { userId: 'u1', tenantId: 't1' };
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Mock de todas as tarefas da clínica
      const mockTasks = [
        { id: 'task-1', title: 'Beber Água' },
        { id: 'task-2', title: 'Caminhada' }
      ];

      // Mock das conclusões do dia (apenas a task-1 foi feita)
      const mockCompletions = [
        { taskId: 'task-1', patientId: 'u1' }
      ];

      jest.spyOn(repository, 'findTasksByTenant').mockResolvedValue(mockTasks as any);
      jest.spyOn(repository, 'findCompletionsByPatientToday').mockResolvedValue(mockCompletions as any);

      const result = await service.getDailyTasks(mockUser as any);

      // Verificações
      expect(result).toHaveLength(2);
      expect(result[0].completed).toBe(true);  // Beber Água completada
      expect(result[1].completed).toBe(false); // Caminhada pendente

      // Garante que a data foi resetada para meia-noite
      expect(repository.findCompletionsByPatientToday).toHaveBeenCalledWith('u1', today);
    });
  });
  // Adicione este teste para cobrir a linha "if (!activeBoss)" de image_ba77a8.png
  describe('checkAndApplyBossDamage (Private Method)', () => {
    it('deve retornar 0 de dano se a query do BossBattle não encontrar um registro ativo', async () => {
      // Simulamos a transação do Prisma onde o bossBattle retorna null
      const mockTx = {
        bossBattle: {
          findFirst: jest.fn().mockResolvedValue(null),
          updateMany: jest.fn()
        }
      };

      // Usamos a técnica de casting para acessar o método privado
      const damage = await (service as any).checkAndApplyBossDamage(mockTx, 'tenant-sem-boss', 100);

      expect(damage).toBe(0);
      expect(mockTx.bossBattle.updateMany).not.toHaveBeenCalled(); // Não deve tentar atualizar
    });

  });

  it('deve subir de nível e disparar conquistas quando o XP atinge o limite', async () => {
    const mockTask = { id: 't1', xpReward: 1000 };
    jest.spyOn(repository, 'findSpecificCompletionToday').mockResolvedValue(null);
    jest.spyOn(repository, 'findById').mockResolvedValue(mockTask as any);

    const result = await service.completeTask('t1', mockUser as any);

    expect(result.level_up).toBe(true);
    // CORREÇÃO: Usar a instância 'achievementsService', não a classe 'AchievementsService'
    expect(achievementsService.checkLevelAchievements).toHaveBeenCalledWith(mockUser.userId, mockUser.tenantId, 2);
  });

  describe('Vitória via Missão', () => {
    it('deve disparar handleBossVictory quando o dano de uma missão zerar o HP do Boss', async () => {
      const taskId = 'task-id';
      const activeBoss = { id: 'boss-1', currentHp: 50 };
      const taskReward = 100;

      jest.spyOn(repository, 'findById').mockResolvedValue({ id: taskId, xpReward: taskReward } as any);

      // CORREÇÃO 3: Casting 'as any' em todos os sub-objetos do mock da transação
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
        return cb({
          taskCompletion: { create: jest.fn() } as any,
          playerStats: {
            upsert: jest.fn().mockResolvedValue({ currentLevel: 1, currentXp: 0 }),
            update: jest.fn()
          } as any,
          bossBattle: {
            findFirst: jest.fn().mockResolvedValue(activeBoss),
            update: jest.fn()
          } as any
        } as any);
      });

      const victorySpy = jest.spyOn(recordsService, 'handleBossVictory');

      await service.completeTask(taskId, mockUser as any);

      // Verifica se a lógica de vitória foi acionada corretamente
      expect(victorySpy).toHaveBeenCalledWith(activeBoss.id, mockUser.tenantId);
    });
  });

});