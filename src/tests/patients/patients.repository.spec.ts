import { Gender } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPatientsRepository } from '../../patients/infrastructure/persistence/prisma-patients.repository';
import { TenantScopedPrismaFactory } from '../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';

describe('PrismaPatientsRepository', () => {
  let repository: PrismaPatientsRepository;
  let tenantScopedPrismaFactory: TenantScopedPrismaFactory;

  const tenantPrisma = {
    patient: {
      findFirst: jest.fn(),
    },
    patientProfile: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaPatientsRepository,
        {
          provide: TenantScopedPrismaFactory,
          useValue: {
            forTenantContext: jest.fn().mockReturnValue(tenantPrisma),
            runInTenantTransaction: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaPatientsRepository>(PrismaPatientsRepository);
    tenantScopedPrismaFactory = module.get<TenantScopedPrismaFactory>(TenantScopedPrismaFactory);
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

    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context: any, callback: any) => callback(tx),
    );

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

  it('deve buscar paciente por supabaseId dentro do tenant', async () => {
    await repository.findBySupabaseId('patient-1', 'tenant-1');

    expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
      userId: 'patient-1',
      tenantId: 'tenant-1',
    });
    expect(tenantPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-1', tenantId: 'tenant-1' },
    });
  });

  it('deve buscar paciente por id dentro do tenant', async () => {
    await repository.findById('patient-2', 'tenant-1');

    expect(tenantPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-2', tenantId: 'tenant-1' },
    });
  });

  it('deve fazer upsert do perfil clinico do paciente do tenant', async () => {
    const dto = {
      initialGoals: 'Perder peso',
      symptoms: 'Dor lombar',
      pathologies: 'Hipertensao',
      medicalNotes: 'Acompanhar pressao',
    };

    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'patient-1', tenantId: 'tenant-1' } as any);

    await repository.updateProfile('patient-1', 'tenant-1', dto);

    expect(repository.findById).toHaveBeenCalledWith('patient-1', 'tenant-1');
    expect(tenantScopedPrismaFactory.forTenantContext).toHaveBeenCalledWith({
      userId: 'patient-1',
      tenantId: 'tenant-1',
    });
    expect(tenantPrisma.patientProfile.upsert).toHaveBeenCalledWith({
      where: { patientId: 'patient-1' },
      update: dto,
      create: {
        patientId: 'patient-1',
        ...dto,
      },
    });
  });
});
