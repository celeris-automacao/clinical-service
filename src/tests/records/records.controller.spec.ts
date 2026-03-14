import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserContext } from '../../shared/auth/user-context';
import { CreateClinicalRecordUseCase } from '../../records/application/use-cases/create-clinical-record.use-case';
import { GetPatientEvolutionUseCase } from '../../records/application/use-cases/get-patient-evolution.use-case';
import { GetPatientStatsUseCase } from '../../records/application/use-cases/get-patient-stats.use-case';
import { RecordsController } from '../../records/presentation/http/records.controller';

describe('RecordsController', () => {
  let controller: RecordsController;
  let createClinicalRecordUseCase: CreateClinicalRecordUseCase;
  let getPatientEvolutionUseCase: GetPatientEvolutionUseCase;
  let getPatientStatsUseCase: GetPatientStatsUseCase;

  const mockUser: UserContext = {
    userId: 'user-uuid',
    tenantId: 'tenant-uuid',
    role: 'patient',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordsController],
      providers: [
        {
          provide: CreateClinicalRecordUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: '1', weight: 80 }),
          },
        },
        {
          provide: GetPatientEvolutionUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: GetPatientStatsUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ totalDamage: 0 }),
          },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RecordsController>(RecordsController);
    createClinicalRecordUseCase = module.get<CreateClinicalRecordUseCase>(CreateClinicalRecordUseCase);
    getPatientEvolutionUseCase = module.get<GetPatientEvolutionUseCase>(GetPatientEvolutionUseCase);
    getPatientStatsUseCase = module.get<GetPatientStatsUseCase>(GetPatientStatsUseCase);
  });

  it('deve chamar o use case com os dados corretos ao criar um registro', async () => {
    const dto = { weight: 85.5, skeletal_muscle_mass: 35 };

    await controller.createRecord(dto as any, mockUser);

    expect(createClinicalRecordUseCase.execute).toHaveBeenCalledWith(dto, mockUser);
  });

  it('deve retornar o histórico de evolução do paciente', async () => {
    const result = await controller.getEvolution(mockUser);

    expect(getPatientEvolutionUseCase.execute).toHaveBeenCalledWith(mockUser);
    expect(Array.isArray(result)).toBe(true);
  });

  it('deve retornar as estatísticas do paciente', async () => {
    await controller.getStats(mockUser);

    expect(getPatientStatsUseCase.execute).toHaveBeenCalledWith(mockUser);
  });
});
