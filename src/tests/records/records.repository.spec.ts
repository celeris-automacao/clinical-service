import { Test, TestingModule } from '@nestjs/testing';
import { RecordsRepository } from '../../records/infrastructure/persistence/prisma-records.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('RecordsRepository', () => {
  let repository: RecordsRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsRepository,
        {
          provide: PrismaService,
          useValue: {
            clinicalRecord: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<RecordsRepository>(RecordsRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('deve persistir um novo registro clínico com os campos mapeados corretamente', async () => {
      const dto = { weight: 80.5, skeletalMuscleMass: 35, bodyFatMass: 20 };
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      await repository.create(dto, userId, tenantId);

      expect(prisma.clinicalRecord.create).toHaveBeenCalledWith({
        data: {
          weight: dto.weight,
          skeletalMuscleMass: dto.skeletalMuscleMass,
          bodyFatMass: dto.bodyFatMass,
          patientId: userId,
          tenantId: tenantId,
        },
      });
    });
  });

  describe('findAllByPatient', () => {
    it('deve buscar o histórico completo ordenado por data ASCENDENTE para o gráfico', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      await repository.findAllByPatient(userId, tenantId);

      expect(prisma.clinicalRecord.findMany).toHaveBeenCalledWith({
        where: { patientId: userId, tenantId },
        orderBy: { recordedAt: 'asc' }, // Essencial para o gráfico de evolução
      });
    });
  });

  describe('findLastTwo', () => {
    it('deve buscar apenas os 2 registros mais recentes para cálculo de dano', async () => {
      const userId = 'user-123';

      await repository.findLastTwo(userId);

      expect(prisma.clinicalRecord.findMany).toHaveBeenCalledWith({
        where: { patientId: userId },
        orderBy: { recordedAt: 'desc' }, // Mais recentes primeiro
        take: 2,
      });
    });
  });
  describe('getClinicalDamageByTenant', () => {
    it('deve calcular o dano acumulado de todos os pacientes da clínica com base na perda de peso', async () => {
      const tenantId = 'tenant-123';

      // Simulamos um cenário com 2 pacientes e comportamentos diferentes
      const mockRecords = [
        // Paciente 1: Perdeu 5kg no total (100 -> 95)
        { patientId: 'p1', weight: 100, recordedAt: new Date('2023-01-01') },
        { patientId: 'p1', weight: 95, recordedAt: new Date('2023-01-02') },

        // Paciente 2: Ganhou peso (80 -> 82) depois perdeu (82 -> 79)
        // Dano deve ser apenas sobre a perda de 3kg (82-79)
        { patientId: 'p2', weight: 80, recordedAt: new Date('2023-01-01') },
        { patientId: 'p2', weight: 82, recordedAt: new Date('2023-01-02') },
        { patientId: 'p2', weight: 79, recordedAt: new Date('2023-01-03') },
      ];

      jest.spyOn(prisma.clinicalRecord, 'findMany').mockResolvedValue(mockRecords as any);

      const result = await repository.getClinicalDamageByTenant(tenantId);

      // 1. Verificamos se a query foi feita com os filtros e ordenação corretos
      expect(prisma.clinicalRecord.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        select: { patientId: true, weight: true, recordedAt: true },
        orderBy: { recordedAt: 'asc' },
      });

      // 2. Validamos a estrutura de retorno (Map)
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);

      // 3. Verificamos os cálculos matemáticos (Dano = kg * 7700)
      // Paciente 1: 5kg * 7700 = 38500
      expect(result.get('p1')).toBe(38500);

      // Paciente 2: Perda efetiva de 3kg (de 82 para 79) * 7700 = 23100
      // O ganho de 80 para 82 deve ser ignorado pela lógica (if diff > 0)
      expect(result.get('p2')).toBe(23100);
    });

    it('deve retornar um Map vazio se a clínica não possuir registros', async () => {
      jest.spyOn(prisma.clinicalRecord, 'findMany').mockResolvedValue([]);

      const result = await repository.getClinicalDamageByTenant('tenant-vazio');

      expect(result.size).toBe(0);
    });
  });
});
