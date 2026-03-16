import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantPlanPort } from '../../shared/application/ports/tenant-plan.port';
import { TENANT_PLAN_PORT } from '../../shared/shared.tokens';
import { Gender } from '@prisma/client';
import { CreatePatientUseCase } from '../../patients/application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from '../../patients/application/use-cases/get-patient-by-id.use-case';
import { UpdatePatientProfileUseCase } from '../../patients/application/use-cases/update-patient-profile.use-case';
import { PatientsRepositoryPort } from '../../patients/application/ports/patients-repository.port';
import { PATIENTS_REPOSITORY } from '../../patients/patients.tokens';

describe('Patients Use Cases', () => {
  let repository: PatientsRepositoryPort;
  let tenantPlanPort: TenantPlanPort;
  let createPatientUseCase: CreatePatientUseCase;
  let getPatientByIdUseCase: GetPatientByIdUseCase;
  let updatePatientProfileUseCase: UpdatePatientProfileUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePatientUseCase,
        GetPatientByIdUseCase,
        UpdatePatientProfileUseCase,
        {
          provide: PATIENTS_REPOSITORY,
          useValue: {
            createWithStats: jest.fn(),
            countByTenant: jest.fn(),
            findBySupabaseId: jest.fn(),
            findById: jest.fn(),
            updateProfile: jest.fn(),
          },
        },
        {
          provide: TENANT_PLAN_PORT,
          useValue: {
            getTenantPlan: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<PatientsRepositoryPort>(PATIENTS_REPOSITORY);
    tenantPlanPort = module.get<TenantPlanPort>(TENANT_PLAN_PORT);
    createPatientUseCase = module.get<CreatePatientUseCase>(CreatePatientUseCase);
    getPatientByIdUseCase = module.get<GetPatientByIdUseCase>(GetPatientByIdUseCase);
    updatePatientProfileUseCase = module.get<UpdatePatientProfileUseCase>(UpdatePatientProfileUseCase);
  });

  it('deve delegar create para o repositorio com tenantId quando houver capacidade no plano', async () => {
    const dto = {
      supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Paciente Teste',
      email: 'paciente@teste.com',
      phone: '11911111111',
      document: '11122233344',
      gender: Gender.FEMALE,
      birthDate: '1992-05-10',
      address: {
        zipCode: '01311000',
        street: 'Av Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'Sao Paulo',
        state: 'SP',
      },
    };
    const createdPatient = { id: dto.supabaseId, name: dto.name };

    jest.spyOn(tenantPlanPort, 'getTenantPlan').mockResolvedValue({ id: 'plan-1', maxStaff: 10, maxPatients: 2 });
    jest.spyOn(repository, 'countByTenant').mockResolvedValue(1);
    jest.spyOn(repository, 'createWithStats').mockResolvedValue(createdPatient);

    const result = await createPatientUseCase.execute(dto as any, 'tenant-1');

    expect(repository.createWithStats).toHaveBeenCalledWith(dto, 'tenant-1');
    expect(result).toEqual(createdPatient);
  });

  it('deve bloquear criacao quando o limite de pacientes do plano for atingido', async () => {
    jest.spyOn(tenantPlanPort, 'getTenantPlan').mockResolvedValue({ id: 'plan-1', maxStaff: 10, maxPatients: 1 });
    jest.spyOn(repository, 'countByTenant').mockResolvedValue(1);

    await expect(
      createPatientUseCase.execute(
        {
          supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          name: 'Paciente Teste',
        } as any,
        'tenant-1',
      ),
    ).rejects.toThrow(new BadRequestException('Limite de pacientes do plano atingido.'));
  });

  it('deve retornar o paciente quando ele existir no tenant', async () => {
    const patient = { id: 'patient-1', name: 'Paciente Teste' };

    jest.spyOn(repository, 'findById').mockResolvedValue(patient);

    const result = await getPatientByIdUseCase.execute('patient-1', 'tenant-1');

    expect(repository.findById).toHaveBeenCalledWith('patient-1', 'tenant-1');
    expect(result).toEqual(patient);
  });

  it('deve lancar NotFoundException quando o paciente nao existir no tenant', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(getPatientByIdUseCase.execute('patient-404', 'tenant-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deve validar a existencia do paciente no tenant antes de atualizar o perfil', async () => {
    const dto = { initialGoals: 'Ganhar massa muscular' };

    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'patient-1' });
    jest.spyOn(repository, 'updateProfile').mockResolvedValue({ patientId: 'patient-1', ...dto });

    const result = await updatePatientProfileUseCase.execute('patient-1', 'tenant-1', dto);

    expect(repository.findById).toHaveBeenCalledWith('patient-1', 'tenant-1');
    expect(repository.updateProfile).toHaveBeenCalledWith('patient-1', 'tenant-1', dto);
    expect(result).toEqual({ patientId: 'patient-1', ...dto });
  });
});
