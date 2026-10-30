import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantPlanPort } from '../../shared/application/ports/tenant-plan.port';
import { TENANT_PLAN_PORT } from '../../shared/shared.tokens';
import { Gender } from '@prisma/client';
import { CreatePatientUseCase } from '../../patients/application/use-cases/create-patient.use-case';
import { GetPatientByIdUseCase } from '../../patients/application/use-cases/get-patient-by-id.use-case';
import { UpdatePatientProfileUseCase } from '../../patients/application/use-cases/update-patient-profile.use-case';
import { UpdatePatientEmailUseCase } from '../../patients/application/use-cases/update-patient-email.use-case';
import { PatientsRepositoryPort } from '../../patients/application/ports/patients-repository.port';
import { PATIENTS_REPOSITORY } from '../../patients/patients.tokens';

describe('Patients Use Cases', () => {
  let repository: PatientsRepositoryPort;
  let tenantPlanPort: TenantPlanPort;
  let createPatientUseCase: CreatePatientUseCase;
  let getPatientByIdUseCase: GetPatientByIdUseCase;
  let updatePatientProfileUseCase: UpdatePatientProfileUseCase;
  let updatePatientEmailUseCase: UpdatePatientEmailUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePatientUseCase,
        GetPatientByIdUseCase,
        UpdatePatientProfileUseCase,
        UpdatePatientEmailUseCase,
        {
          provide: PATIENTS_REPOSITORY,
          useValue: {
            createWithStats: jest.fn(),
            countByTenant: jest.fn(),
            findByDocument: jest.fn(),
            findBySupabaseId: jest.fn(),
            findById: jest.fn(),
            updateProfile: jest.fn(),
            findByEmail: jest.fn(),
            updateEmail: jest.fn(),
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
    createPatientUseCase =
      module.get<CreatePatientUseCase>(CreatePatientUseCase);
    getPatientByIdUseCase = module.get<GetPatientByIdUseCase>(
      GetPatientByIdUseCase,
    );
    updatePatientProfileUseCase = module.get<UpdatePatientProfileUseCase>(
      UpdatePatientProfileUseCase,
    );
    updatePatientEmailUseCase = module.get<UpdatePatientEmailUseCase>(
      UpdatePatientEmailUseCase,
    );
  });

  it('deve delegar create para o repositorio com tenantId quando houver capacidade no plano', async () => {
    const dto = {
      supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Paciente Teste',
      email: 'paciente@teste.com',
      phone: '11911111111',
      document: '52998224725',
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

    jest
      .spyOn(tenantPlanPort, 'getTenantPlan')
      .mockResolvedValue({ id: 'plan-1', maxStaff: 10, maxPatients: 2 });
    jest.spyOn(repository, 'countByTenant').mockResolvedValue(1);
    jest.spyOn(repository, 'findByDocument').mockResolvedValue(null);
    jest.spyOn(repository, 'createWithStats').mockResolvedValue(createdPatient);

    const mockUserContext = {
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: 'admin',
    };

    const result = await createPatientUseCase.execute(
      dto as any,
      mockUserContext as any,
    );

    expect(repository.createWithStats).toHaveBeenCalledWith(
      dto,
      'tenant-1',
      'user-1',
    );
    expect(result).toEqual(createdPatient);
  });

  it('deve bloquear criacao quando o limite de pacientes do plano for atingido', async () => {
    jest
      .spyOn(tenantPlanPort, 'getTenantPlan')
      .mockResolvedValue({ id: 'plan-1', maxStaff: 10, maxPatients: 1 });
    jest.spyOn(repository, 'countByTenant').mockResolvedValue(1);

    await expect(
      createPatientUseCase.execute(
        {
          supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          name: 'Paciente Teste',
          email: 'paciente@teste.com',
          phone: '11911111111',
          document: '52998224725',
        } as any,
        { tenantId: 'tenant-1', userId: 'user-1', role: 'admin' } as any,
      ),
    ).rejects.toThrow(
      new BadRequestException('Limite de pacientes do plano atingido.'),
    );
  });

  it('deve rejeitar CPF invalido antes de persistir o paciente', async () => {
    await expect(
      createPatientUseCase.execute(
        {
          supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          name: 'Paciente Teste',
          email: 'paciente@teste.com',
          phone: '11911111111',
          document: '11111111111',
        } as any,
        { tenantId: 'tenant-1', userId: 'user-1', role: 'admin' } as any,
      ),
    ).rejects.toThrow('Informe um CPF valido.');
    expect(repository.createWithStats).not.toHaveBeenCalled();
  });

  it.each([
    { email: '', phone: '11911111111' },
    { email: 'paciente@teste.com', phone: '' },
  ])('deve exigir e-mail e telefone: %o', async (contact) => {
    await expect(
      createPatientUseCase.execute(
        {
          name: 'Paciente Teste',
          ...contact,
          document: '52998224725',
        } as any,
        { tenantId: 'tenant-1', userId: 'user-1', role: 'admin' } as any,
      ),
    ).rejects.toThrow('Nome, e-mail, telefone e CPF sao obrigatorios.');
    expect(repository.createWithStats).not.toHaveBeenCalled();
  });

  it.each(['2024-02-31', '2999-01-01'])(
    'deve rejeitar data de nascimento invalida ou futura: %s',
    async (birthDate) => {
      jest.spyOn(repository, 'findByDocument').mockResolvedValue(null);

      await expect(
        createPatientUseCase.execute(
          {
            name: 'Paciente Teste',
            email: 'paciente@teste.com',
            phone: '11911111111',
            document: '52998224725',
            birthDate,
          } as any,
          { tenantId: 'tenant-1', userId: 'user-1', role: 'admin' } as any,
        ),
      ).rejects.toThrow('Informe uma data de nascimento valida.');
      expect(repository.createWithStats).not.toHaveBeenCalled();
    },
  );

  it('deve impedir CPF duplicado na mesma clinica', async () => {
    jest.spyOn(repository, 'findByDocument').mockResolvedValue({ id: 'other' });

    await expect(
      createPatientUseCase.execute(
        {
          supabaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          name: 'Paciente Teste',
          email: 'paciente@teste.com',
          phone: '11911111111',
          document: '529.982.247-25',
        } as any,
        { tenantId: 'tenant-1', userId: 'user-1', role: 'admin' } as any,
      ),
    ).rejects.toThrow('Ja existe um paciente com este CPF nesta clinica.');
    expect(repository.findByDocument).toHaveBeenCalledWith(
      '52998224725',
      'tenant-1',
    );
  });

  it('deve cadastrar contato sem vincular uma conta Supabase', async () => {
    const dto = {
      name: 'Paciente Teste',
      email: ' PACIENTE@TESTE.COM ',
      phone: '(11) 91111-1111',
      document: '529.982.247-25',
    } as any;
    jest.spyOn(repository, 'findByDocument').mockResolvedValue(null);
    jest.spyOn(tenantPlanPort, 'getTenantPlan').mockResolvedValue({
      id: 'plan-1',
      maxStaff: 10,
      maxPatients: 2,
    });
    jest.spyOn(repository, 'countByTenant').mockResolvedValue(1);
    jest
      .spyOn(repository, 'createWithStats')
      .mockResolvedValue({ id: 'new-id' });

    await createPatientUseCase.execute(dto, {
      tenantId: 'tenant-1',
      userId: 'owner-1',
      role: 'owner',
    } as any);

    expect(repository.createWithStats).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Paciente Teste',
        email: 'paciente@teste.com',
        phone: '11911111111',
        document: '52998224725',
      }),
      'tenant-1',
      'owner-1',
    );
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

    await expect(
      getPatientByIdUseCase.execute('patient-404', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deve validar a existencia do paciente no tenant antes de atualizar o perfil', async () => {
    const dto = { initialGoals: 'Ganhar massa muscular' };

    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'patient-1' });
    jest
      .spyOn(repository, 'updateProfile')
      .mockResolvedValue({ patientId: 'patient-1', ...dto });

    const result = await updatePatientProfileUseCase.execute(
      'patient-1',
      'tenant-1',
      dto,
    );

    expect(repository.findById).toHaveBeenCalledWith('patient-1', 'tenant-1');
    expect(repository.updateProfile).toHaveBeenCalledWith(
      'patient-1',
      'tenant-1',
      dto,
    );
    expect(result).toEqual({ patientId: 'patient-1', ...dto });
  });

  it('deve permitir atualizar e-mail de contato dentro do tenant e impedir duplicidade', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'patient-1' });
    jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);
    jest.spyOn(repository, 'updateEmail').mockResolvedValue({
      id: 'patient-1',
      email: 'novo@teste.com',
    });

    const result = await updatePatientEmailUseCase.execute(
      'patient-1',
      'novo@teste.com',
      { tenantId: 'tenant-1', userId: 'staff-1', role: 'doctor' },
    );

    expect(repository.findById).toHaveBeenCalledWith('patient-1', 'tenant-1');
    expect(repository.findByEmail).toHaveBeenCalledWith(
      'novo@teste.com',
      'tenant-1',
      'patient-1',
    );
    expect(repository.updateEmail).toHaveBeenCalledWith(
      'patient-1',
      'tenant-1',
      'novo@teste.com',
    );
    expect(result.email).toBe('novo@teste.com');
  });

  it('deve negar ao paciente a alteração do e-mail de outro paciente', async () => {
    await expect(
      updatePatientEmailUseCase.execute('patient-1', 'novo@teste.com', {
        tenantId: 'tenant-1',
        userId: 'patient-2',
        role: 'patient',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.findById).not.toHaveBeenCalled();
  });
});
