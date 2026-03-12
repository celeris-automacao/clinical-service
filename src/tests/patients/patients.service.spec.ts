import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Gender } from '@prisma/client';
import { IPatientsRepository } from '../../patients/repositories/interfaces/patients-repository.interface';
import { PatientsService } from '../../patients/patients.service';

describe('PatientsService', () => {
  let service: PatientsService;
  let repository: IPatientsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        {
          provide: 'IPatientsRepository',
          useValue: {
            createWithStats: jest.fn(),
            findBySupabaseId: jest.fn(),
            findById: jest.fn(),
            updateProfile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    repository = module.get<IPatientsRepository>('IPatientsRepository');
  });

  it('deve delegar create para o repositorio com tenantId', async () => {
    const dto = {
      supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Paciente Teste',
      gender: Gender.FEMALE,
      birthDate: '1992-05-10',
    };
    const createdPatient = { id: dto.supabaseId, name: dto.name };

    jest.spyOn(repository, 'createWithStats').mockResolvedValue(createdPatient as any);

    const result = await service.create(dto, 'tenant-1');

    expect(repository.createWithStats).toHaveBeenCalledWith(dto, 'tenant-1');
    expect(result).toEqual(createdPatient);
  });

  it('deve retornar o paciente quando ele existir', async () => {
    const patient = { id: 'patient-1', name: 'Paciente Teste' };

    jest.spyOn(repository, 'findById').mockResolvedValue(patient as any);

    const result = await service.findOne('patient-1');

    expect(repository.findById).toHaveBeenCalledWith('patient-1');
    expect(result).toEqual(patient);
  });

  it('deve lancar NotFoundException quando o paciente nao existir', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(service.findOne('patient-404')).rejects.toThrow(NotFoundException);
  });

  it('deve validar a existencia do paciente antes de atualizar o perfil', async () => {
    const dto = { initialGoals: 'Ganhar massa muscular' };

    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'patient-1' } as any);
    jest.spyOn(repository, 'updateProfile').mockResolvedValue({ patientId: 'patient-1', ...dto });

    const result = await service.updateProfile('patient-1', dto);

    expect(repository.findById).toHaveBeenCalledWith('patient-1');
    expect(repository.updateProfile).toHaveBeenCalledWith('patient-1', dto);
    expect(result).toEqual({ patientId: 'patient-1', ...dto });
  });
});
