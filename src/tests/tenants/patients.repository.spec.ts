import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto } from '../../tenants/presentation/http/dto/create-patient.dto';
import { PatientsRepository } from '../../tenants/infrastructure/persistence/prisma-tenant-patients.repository';

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
          },
        },
      ],
    }).compile();

    repository = module.get<PatientsRepository>(PatientsRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve criar o paciente e os atributos iniciais dentro de uma transacao', async () => {
    const dto: CreatePatientDto = {
      supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Paciente Teste',
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

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.patient.create).toHaveBeenCalledWith({
      data: {
        id: dto.supabaseId,
        name: dto.name,
        tenantId,
      },
    });
    expect(tx.playerStats.create).toHaveBeenCalledWith({
      data: {
        patientId: createdPatient.id,
        tenantId,
        currentLevel: 1,
        currentXp: 0,
        currentGold: 0,
        totalDamageDealt: 0,
      },
    });
    expect(result).toEqual(createdPatient);
  });

  it('deve buscar um paciente pelo supabaseId', async () => {
    await repository.findBySupabaseId('patient-1');

    expect(prisma.patient.findUnique).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
    });
  });
});
