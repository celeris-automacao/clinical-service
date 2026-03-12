import { Test, TestingModule } from '@nestjs/testing';
import { Gender } from '@prisma/client';
import { PatientsController } from '../../patients/patients.controller';
import { PatientsService } from '../../patients/patients.service';

describe('PatientsController', () => {
  let controller: PatientsController;
  let service: PatientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        {
          provide: PatientsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'patient-1' }),
            findOne: jest.fn().mockResolvedValue({ id: 'patient-1' }),
            updateProfile: jest.fn().mockResolvedValue({ patientId: 'patient-1' }),
          },
        },
      ],
    }).compile();

    controller = module.get<PatientsController>(PatientsController);
    service = module.get<PatientsService>(PatientsService);
  });

  it('deve repassar o dto e o x-tenant-id para o service.create', async () => {
    const dto = {
      supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Paciente Teste',
      gender: Gender.MALE,
      birthDate: '1990-01-01',
    };

    await controller.create(dto, 'tenant-1');

    expect(service.create).toHaveBeenCalledWith(dto, 'tenant-1');
  });

  it('deve repassar o id para o service.findOne', async () => {
    await controller.findOne('patient-1');

    expect(service.findOne).toHaveBeenCalledWith('patient-1');
  });

  it('deve repassar id e dto para o service.updateProfile', async () => {
    const dto = {
      initialGoals: 'Perder peso',
      symptoms: 'Cansaco',
    };

    await controller.updateProfile('patient-1', dto);

    expect(service.updateProfile).toHaveBeenCalledWith('patient-1', dto);
  });
});
