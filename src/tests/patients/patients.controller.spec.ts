import { Test, TestingModule } from '@nestjs/testing';
import { Gender } from '@prisma/client';
import { SupabaseGuard } from '../../auth/guards/supabase.guard';
import { PatientsController } from '../../patients/presentation/http/patients.controller';
import { CreatePatientUseCase } from '../../patients/application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from '../../patients/application/use-cases/get-patient-by-id.use-case';
import { UpdatePatientProfileUseCase } from '../../patients/application/use-cases/update-patient-profile.use-case';
import { UserContext } from '../../shared/auth/user-context';

describe('PatientsController', () => {
  let controller: PatientsController;
  let createPatientUseCase: CreatePatientUseCase;
  let getPatientByIdUseCase: GetPatientByIdUseCase;
  let updatePatientProfileUseCase: UpdatePatientProfileUseCase;

  const user: UserContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'doctor',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        {
          provide: CreatePatientUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: 'patient-1' }),
          },
        },
        {
          provide: GetPatientByIdUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: 'patient-1' }),
          },
        },
        {
          provide: UpdatePatientProfileUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ patientId: 'patient-1' }),
          },
        },
      ],
    })
      .overrideGuard(SupabaseGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<PatientsController>(PatientsController);
    createPatientUseCase = module.get<CreatePatientUseCase>(CreatePatientUseCase);
    getPatientByIdUseCase = module.get<GetPatientByIdUseCase>(GetPatientByIdUseCase);
    updatePatientProfileUseCase = module.get<UpdatePatientProfileUseCase>(UpdatePatientProfileUseCase);
  });

  it('deve repassar o dto e o tenant do usuario para o use case de criacao', async () => {
    const dto = {
      supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Paciente Teste',
      gender: Gender.MALE,
      birthDate: '1990-01-01',
    };

    await controller.create(dto, user);

    expect(createPatientUseCase.execute).toHaveBeenCalledWith(dto, 'tenant-1');
  });

  it('deve repassar o id e o tenant para o use case de busca', async () => {
    await controller.findOne('patient-1', user);

    expect(getPatientByIdUseCase.execute).toHaveBeenCalledWith('patient-1', 'tenant-1');
  });

  it('deve repassar id, tenant e dto para o use case de updateProfile', async () => {
    const dto = {
      initialGoals: 'Perder peso',
      symptoms: 'Cansaco',
    };

    await controller.updateProfile('patient-1', dto, user);

    expect(updatePatientProfileUseCase.execute).toHaveBeenCalledWith('patient-1', 'tenant-1', dto);
  });
});
