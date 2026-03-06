import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../../dashboard/dashboard.service';
import { IDashboardRepository } from '../../dashboard/repositories/interfaces/dashboard.repository.interface';

describe('DashboardService - Suite Completa', () => {
  let service: DashboardService;
  // MUDANÇA: Tipar como Interface
  let repository: IDashboardRepository; 
  const mockTenantId = 'tenant-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          // MUDANÇA CRÍTICA: Usar a string token
          provide: 'IDashboardRepository', 
          useValue: {
            countActivePlayers: jest.fn(),
            findRecentAchievements: jest.fn(),
            findTopPlayers: jest.fn(),
            getTaskCompletionsHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    repository = module.get<IDashboardRepository>('IDashboardRepository');
  });

  describe('getClinicOverview', () => {
    it('deve retornar zeros e listas vazias quando não houver dados na clínica', async () => {
      // Caso de borda: Clínica nova sem atividade
      (repository.countActivePlayers as jest.Mock).mockResolvedValue(0);
      (repository.findRecentAchievements as jest.Mock).mockResolvedValue([]);
      (repository.findTopPlayers as jest.Mock).mockResolvedValue([]);

      const result = await service.getClinicOverview(mockTenantId);

      expect(result.activeToday).toBe(0); // [cite: 428]
      expect(result.recentAchievements).toHaveLength(0); // [cite: 429]
      expect(result.ranking).toHaveLength(0); // [cite: 430]
    });
  });

  describe('getMissingPatients', () => {
    it('deve identificar corretamente a ÚLTIMA atividade de um paciente com múltiplos registros', async () => {
      // Caso Crítico: O paciente fez algo há 10 dias E ontem. Ele NÃO deve estar inativo.
      const today = new Date();
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(today.getDate() - 10);
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const mockHistory = [
        { patientId: 'p1', completedAt: yesterday }, // Mais recente [cite: 433, 435]
        { patientId: 'p1', completedAt: tenDaysAgo }  // Registro antigo
      ];

      (repository.getTaskCompletionsHistory as jest.Mock).mockResolvedValue(mockHistory);

      const result = await service.getMissingPatients(mockTenantId, 3); // Limite de 3 dias 

      expect(result).toHaveLength(0); // P1 é considerado ativo porque sua última data foi ontem
    });

    it('deve respeitar o parâmetro customizado de dias de inatividade', async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(new Date().getDate() - 5);

      (repository.getTaskCompletionsHistory as jest.Mock).mockResolvedValue([
        { patientId: 'p2', completedAt: fiveDaysAgo }
      ]);

      // Se testarmos com 7 dias, ele NÃO está inativo 
      const resultAtivo = await service.getMissingPatients(mockTenantId, 7);
      expect(resultAtivo).toHaveLength(0);

      // Se testarmos com 3 dias, ele ESTÁ inativo 
      const resultInativo = await service.getMissingPatients(mockTenantId, 3);
      expect(resultInativo).toHaveLength(1);
    });

    it('deve retornar lista vazia se ninguém tiver completado tarefas na clínica', async () => {
      (repository.getTaskCompletionsHistory as jest.Mock).mockResolvedValue([]);
      
      const result = await service.getMissingPatients(mockTenantId);
      expect(result).toEqual([]); // 
    });
  });
});