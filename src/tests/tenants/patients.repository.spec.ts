import { Test, TestingModule } from '@nestjs/testing';
import { TenantScopedPrismaFactory } from '../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { CreatePatientDto } from '../../tenants/presentation/http/dto/create-patient.dto';
import { PrismaTenantPatientsRepository } from '../../tenants/infrastructure/persistence/prisma-tenant-patients.repository';

describe('PrismaTenantPatientsRepository', () => {
  let repository: PrismaTenantPatientsRepository;
  let tenantScopedPrismaFactory: TenantScopedPrismaFactory;

  const rootPrisma = {
    patient: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTenantPatientsRepository,
        {
          provide: TenantScopedPrismaFactory,
          useValue: {
            forRoot: jest.fn().mockReturnValue(rootPrisma),
            forTenant: jest.fn().mockReturnValue(rootPrisma),
            runInTenantTransaction: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaTenantPatientsRepository>(PrismaTenantPatientsRepository);
    tenantScopedPrismaFactory = module.get<TenantScopedPrismaFactory>(TenantScopedPrismaFactory);
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

    (tenantScopedPrismaFactory.runInTenantTransaction as jest.Mock).mockImplementation(
      async (_context: any, callback: any) => callback(tx),
    );

    const result = await repository.createWithStats(dto, tenantId);

    expect(tenantScopedPrismaFactory.runInTenantTransaction).toHaveBeenCalled();
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

    expect(rootPrisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
    });
  });
});
