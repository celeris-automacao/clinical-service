import { Test, TestingModule } from '@nestjs/testing';
import { Gender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientsRepository } from '../../patients/infrastructure/persistence/prisma-patients.repository';

describe('PatientsRepository', () => {
  let repository: PatientsRepository;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsRepository,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            patient: {
              findUnique: jest.fn(),
            },
            patientProfile: {
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    repository = module.get<PatientsRepository>(PatientsRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve criar paciente e playerStats iniciais dentro da transacao', async () => {
    const dto = {
      supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Paciente Teste',
      gender: Gender.MALE,
      birthDate: '1990-01-01',
    };
    const tenantId = 'tenant-1';
    const createdPatient = { id: dto.supabaseId, name: dto.name, tenantId };
    const tx = {
      patient: {
        create: jest.fn().mockResolvedValue(createdPatient),
      },
      playerStats: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback(tx));

    const result = await repository.createWithStats(dto, tenantId);

    expect(tx.patient.create).toHaveBeenCalledWith({
      data: {
        id: dto.supabaseId,
        name: dto.name,
        tenantId,
        gender: dto.gender,
        birthDate: new Date(dto.birthDate),
      },
    });
    expect(tx.playerStats.create).toHaveBeenCalledWith({
      data: {
        patientId: createdPatient.id,
        tenantId,
        currentLevel: 1,
      },
    });
    expect(result).toEqual(createdPatient);
  });

  it('deve buscar paciente por supabaseId', async () => {
    await repository.findBySupabaseId('patient-1');

    expect(prisma.patient.findUnique).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
    });
  });

  it('deve buscar paciente por id', async () => {
    await repository.findById('patient-2');

    expect(prisma.patient.findUnique).toHaveBeenCalledWith({
      where: { id: 'patient-2' },
    });
  });

  it('deve fazer upsert do perfil clinico do paciente', async () => {
    const dto = {
      initialGoals: 'Perder peso',
      symptoms: 'Dor lombar',
      pathologies: 'Hipertensao',
      medicalNotes: 'Acompanhar pressao',
    };

    await repository.updateProfile('patient-1', dto);

    expect(prisma.patientProfile.upsert).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      update: dto,
      create: {
        patientId: 'patient-1',
        ...dto,
      },
    });
  });
});
