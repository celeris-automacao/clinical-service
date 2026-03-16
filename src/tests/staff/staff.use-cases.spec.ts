import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantPlanPort } from '../../shared/application/ports/tenant-plan.port';
import { TENANT_PLAN_PORT } from '../../shared/shared.tokens';
import { UserContext } from '../../shared/auth/user-context';
import { StaffAuditLogPort } from '../../staff/application/ports/staff-audit-log.port';
import { StaffRepositoryPort } from '../../staff/application/ports/staff-repository.port';
import { AcceptStaffInvitationUseCase } from '../../staff/application/use-cases/accept-staff-invitation.use-case';
import { ChangeStaffMemberStatusUseCase } from '../../staff/application/use-cases/change-staff-member-status.use-case';
import { CleanupExpiredStaffInvitationsUseCase } from '../../staff/application/use-cases/cleanup-expired-staff-invitations.use-case';
import { CreateStaffInvitationUseCase } from '../../staff/application/use-cases/create-staff-invitation.use-case';
import { CreateStaffMemberUseCase } from '../../staff/application/use-cases/create-staff-member.use-case';
import { GetMyStaffContextUseCase } from '../../staff/application/use-cases/get-my-staff-context.use-case';
import { GetStaffMemberByIdUseCase } from '../../staff/application/use-cases/get-staff-member-by-id.use-case';
import { GetStaffMemberByUserIdUseCase } from '../../staff/application/use-cases/get-staff-member-by-user-id.use-case';
import { ListPendingStaffInvitationsUseCase } from '../../staff/application/use-cases/list-pending-staff-invitations.use-case';
import { ListStaffAuditLogsUseCase } from '../../staff/application/use-cases/list-staff-audit-logs.use-case';
import { ListStaffMembersUseCase } from '../../staff/application/use-cases/list-staff-members.use-case';
import { RevokeStaffInvitationUseCase } from '../../staff/application/use-cases/revoke-staff-invitation.use-case';
import { UpdateStaffMemberUseCase } from '../../staff/application/use-cases/update-staff-member.use-case';
import { STAFF_AUDIT_LOG_PORT, STAFF_REPOSITORY } from '../../staff/staff.tokens';

describe('Staff Use Cases', () => {
  let repository: StaffRepositoryPort;
  let auditLogPort: StaffAuditLogPort;
  let tenantPlanPort: TenantPlanPort;
  let createStaffMemberUseCase: CreateStaffMemberUseCase;
  let createStaffInvitationUseCase: CreateStaffInvitationUseCase;
  let acceptStaffInvitationUseCase: AcceptStaffInvitationUseCase;
  let getMyStaffContextUseCase: GetMyStaffContextUseCase;
  let getStaffMemberByIdUseCase: GetStaffMemberByIdUseCase;
  let getStaffMemberByUserIdUseCase: GetStaffMemberByUserIdUseCase;
  let listPendingStaffInvitationsUseCase: ListPendingStaffInvitationsUseCase;
  let listStaffMembersUseCase: ListStaffMembersUseCase;
  let listStaffAuditLogsUseCase: ListStaffAuditLogsUseCase;
  let revokeStaffInvitationUseCase: RevokeStaffInvitationUseCase;
  let cleanupExpiredStaffInvitationsUseCase: CleanupExpiredStaffInvitationsUseCase;
  let updateStaffMemberUseCase: UpdateStaffMemberUseCase;
  let changeStaffMemberStatusUseCase: ChangeStaffMemberStatusUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateStaffMemberUseCase,
        CreateStaffInvitationUseCase,
        AcceptStaffInvitationUseCase,
        GetMyStaffContextUseCase,
        GetStaffMemberByIdUseCase,
        GetStaffMemberByUserIdUseCase,
        ListPendingStaffInvitationsUseCase,
        ListStaffMembersUseCase,
        ListStaffAuditLogsUseCase,
        RevokeStaffInvitationUseCase,
        CleanupExpiredStaffInvitationsUseCase,
        UpdateStaffMemberUseCase,
        ChangeStaffMemberStatusUseCase,
        {
          provide: STAFF_REPOSITORY,
          useValue: {
            create: jest.fn(),
            findAllByTenant: jest.fn(),
            findById: jest.fn(),
            findByUserId: jest.fn(),
            findByEmail: jest.fn(),
            findByDocument: jest.fn(),
            findByLicenseNumber: jest.fn(),
            update: jest.fn(),
            changeStatus: jest.fn(),
            countActiveByRole: jest.fn(),
            createInvitation: jest.fn(),
            findPendingInvitationByEmail: jest.fn(),
            findPendingInvitationByDocument: jest.fn(),
            findPendingInvitationByLicenseNumber: jest.fn(),
            findPendingInvitationsByTenant: jest.fn(),
            findInvitationById: jest.fn(),
            findInvitationByToken: jest.fn(),
            acceptInvitation: jest.fn(),
            revokeInvitation: jest.fn(),
            cleanupExpiredInvitations: jest.fn(),
            findAuditLogsByTenant: jest.fn(),
            countByTenant: jest.fn(),
          },
        },
        {
          provide: STAFF_AUDIT_LOG_PORT,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
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

    repository = module.get<StaffRepositoryPort>(STAFF_REPOSITORY);
    auditLogPort = module.get<StaffAuditLogPort>(STAFF_AUDIT_LOG_PORT);
    tenantPlanPort = module.get<TenantPlanPort>(TENANT_PLAN_PORT);
    createStaffMemberUseCase = module.get<CreateStaffMemberUseCase>(CreateStaffMemberUseCase);
    createStaffInvitationUseCase = module.get<CreateStaffInvitationUseCase>(
      CreateStaffInvitationUseCase,
    );
    acceptStaffInvitationUseCase = module.get<AcceptStaffInvitationUseCase>(
      AcceptStaffInvitationUseCase,
    );
    getMyStaffContextUseCase = module.get<GetMyStaffContextUseCase>(GetMyStaffContextUseCase);
    getStaffMemberByIdUseCase = module.get<GetStaffMemberByIdUseCase>(GetStaffMemberByIdUseCase);
    getStaffMemberByUserIdUseCase = module.get<GetStaffMemberByUserIdUseCase>(
      GetStaffMemberByUserIdUseCase,
    );
    listPendingStaffInvitationsUseCase = module.get<ListPendingStaffInvitationsUseCase>(
      ListPendingStaffInvitationsUseCase,
    );
    listStaffMembersUseCase = module.get<ListStaffMembersUseCase>(ListStaffMembersUseCase);
    listStaffAuditLogsUseCase = module.get<ListStaffAuditLogsUseCase>(ListStaffAuditLogsUseCase);
    revokeStaffInvitationUseCase = module.get<RevokeStaffInvitationUseCase>(
      RevokeStaffInvitationUseCase,
    );
    cleanupExpiredStaffInvitationsUseCase = module.get<CleanupExpiredStaffInvitationsUseCase>(
      CleanupExpiredStaffInvitationsUseCase,
    );
    updateStaffMemberUseCase = module.get<UpdateStaffMemberUseCase>(UpdateStaffMemberUseCase);
    changeStaffMemberStatusUseCase = module.get<ChangeStaffMemberStatusUseCase>(
      ChangeStaffMemberStatusUseCase,
    );
  });

  it('deve criar um profissional quando nao houver conflitos de usuario, documento e licenca', async () => {
    const dto = {
      userId: '9cbf5f90-cb9d-4cb1-b9f2-761e9e57b9ab',
      name: 'Dra. Ana',
      document: '12345678900',
      professionalType: 'doctor',
      specialty: 'clinica geral',
      role: 'doctor',
      licenseNumber: 'CRM-123',
    };

    jest.spyOn(tenantPlanPort, 'getTenantPlan').mockResolvedValue({ id: 'plan-1', maxStaff: 2, maxPatients: 100 });
    jest.spyOn(repository, 'countByTenant').mockResolvedValue(1);
    jest.spyOn(repository, 'findByUserId').mockResolvedValue(null);
    jest.spyOn(repository, 'findByDocument').mockResolvedValue(null);
    jest.spyOn(repository, 'findByLicenseNumber').mockResolvedValue(null);
    jest.spyOn(repository, 'create').mockResolvedValue({ id: 'staff-1', ...dto, tenantId: 'tenant-1' });

    const result = await createStaffMemberUseCase.execute(dto as any, 'tenant-1', 'actor-1');

    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      tenantId: 'tenant-1',
      status: 'active',
    });
    expect(auditLogPort.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'actor-1',
        action: 'staff.created',
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'staff-1', name: 'Dra. Ana' }));
  });

  it('deve bloquear criacao de staff quando o limite do plano for atingido', async () => {
    jest.spyOn(tenantPlanPort, 'getTenantPlan').mockResolvedValue({ id: 'plan-1', maxStaff: 1, maxPatients: 100 });
    jest.spyOn(repository, 'countByTenant').mockResolvedValue(1);

    await expect(
      createStaffMemberUseCase.execute(
        {
          userId: '9cbf5f90-cb9d-4cb1-b9f2-761e9e57b9ab',
          name: 'Dra. Ana',
          document: '12345678900',
          professionalType: 'doctor',
          specialty: 'clinica geral',
          role: 'doctor',
        } as any,
        'tenant-1',
        'actor-1',
      ),
    ).rejects.toThrow(new BadRequestException('Limite de profissionais do plano atingido.'));
  });

  it('deve criar convite de staff quando nao houver conflito por email, documento ou licenca', async () => {
    jest.spyOn(repository, 'findByEmail').mockResolvedValue(null);
    jest.spyOn(repository, 'findPendingInvitationByEmail').mockResolvedValue(null);
    jest.spyOn(repository, 'findByDocument').mockResolvedValue(null);
    jest.spyOn(repository, 'findPendingInvitationByDocument').mockResolvedValue(null);
    jest.spyOn(repository, 'findByLicenseNumber').mockResolvedValue(null);
    jest.spyOn(repository, 'findPendingInvitationByLicenseNumber').mockResolvedValue(null);
    jest.spyOn(repository, 'createInvitation').mockResolvedValue({ id: 'invite-1', email: 'ana@test.com' } as any);

    const result = await createStaffInvitationUseCase.execute(
      {
        email: 'ana@test.com',
        name: 'Dra. Ana',
        document: '12345678900',
        professionalType: 'doctor',
        specialty: 'clinica geral',
        role: 'doctor',
        licenseNumber: 'CRM-123',
      },
      'tenant-1',
      'actor-1',
    );

    expect(repository.createInvitation).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 'invite-1' }));
  });

  it('deve aceitar convite pendente e criar o staff', async () => {
    const user: UserContext = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'patient',
      email: 'ana@test.com',
    };

    jest.spyOn(repository, 'findInvitationByToken').mockResolvedValue({
      id: 'invite-1',
      tenantId: 'tenant-1',
      email: 'ana@test.com',
      name: 'Dra. Ana',
      document: '12345678900',
      professionalType: 'doctor',
      specialty: 'clinica geral',
      role: 'doctor',
      licenseNumber: 'CRM-123',
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    } as any);
    jest.spyOn(repository, 'findByUserId').mockResolvedValue(null);
    jest.spyOn(repository, 'findByDocument').mockResolvedValue(null);
    jest.spyOn(repository, 'findByLicenseNumber').mockResolvedValue(null);
    jest.spyOn(repository, 'create').mockResolvedValue({ id: 'staff-1' } as any);
    jest.spyOn(repository, 'acceptInvitation').mockResolvedValue({ count: 1 } as any);

    const result = await acceptStaffInvitationUseCase.execute({ token: 'token-1' }, user);

    expect(repository.acceptInvitation).toHaveBeenCalledWith('token-1', 'user-1', 'tenant-1');
    expect(result).toEqual({ id: 'staff-1' });
  });

  it('deve listar convites pendentes por tenant', async () => {
    jest.spyOn(repository, 'findPendingInvitationsByTenant').mockResolvedValue([{ id: 'invite-1' }] as any);

    const result = await listPendingStaffInvitationsUseCase.execute('tenant-1');

    expect(repository.findPendingInvitationsByTenant).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual([{ id: 'invite-1' }]);
  });

  it('deve revogar convite pendente e auditar a acao', async () => {
    jest.spyOn(repository, 'findInvitationById').mockResolvedValue({
      id: 'invite-1',
      email: 'ana@test.com',
      status: 'pending',
    } as any);
    jest.spyOn(repository, 'revokeInvitation').mockResolvedValue({ id: 'invite-1', status: 'revoked' } as any);

    const result = await revokeStaffInvitationUseCase.execute('invite-1', 'tenant-1', 'actor-1');

    expect(repository.revokeInvitation).toHaveBeenCalledWith('invite-1', 'actor-1', 'tenant-1');
    expect(auditLogPort.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'staff.invitation_revoked',
      }),
    );
    expect(result).toEqual({ id: 'invite-1', status: 'revoked' });
  });

  it('deve retornar o contexto de staff do usuario autenticado', async () => {
    jest.spyOn(repository, 'findByUserId').mockResolvedValue({
      id: 'staff-1',
      name: 'Dra. Ana',
      role: 'doctor',
      status: 'active',
      specialty: 'clinica geral',
      professionalType: 'doctor',
      licenseNumber: 'CRM-123',
    } as any);

    const result = await getMyStaffContextUseCase.execute({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'doctor',
      email: 'ana@test.com',
    });

    expect(result.staff).toEqual(
      expect.objectContaining({
        id: 'staff-1',
        role: 'doctor',
      }),
    );
  });

  it('deve executar cleanup de convites expirados', async () => {
    jest.spyOn(repository, 'cleanupExpiredInvitations').mockResolvedValue(3);

    const result = await cleanupExpiredStaffInvitationsUseCase.execute(new Date('2026-03-14T12:00:00Z'));

    expect(repository.cleanupExpiredInvitations).toHaveBeenCalled();
    expect(result).toBe(3);
  });

  it('deve listar os profissionais filtrando pelo tenant', async () => {
    jest.spyOn(repository, 'findAllByTenant').mockResolvedValue([{ id: 'staff-1' }] as any);

    const result = await listStaffMembersUseCase.execute('tenant-1', { role: 'doctor' });

    expect(repository.findAllByTenant).toHaveBeenCalledWith('tenant-1', { role: 'doctor' });
    expect(result).toEqual([{ id: 'staff-1' }]);
  });

  it('deve listar logs de auditoria por tenant', async () => {
    jest.spyOn(repository, 'findAuditLogsByTenant').mockResolvedValue([{ id: 'log-1' }] as any);

    const result = await listStaffAuditLogsUseCase.execute('tenant-1');

    expect(repository.findAuditLogsByTenant).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual([{ id: 'log-1' }]);
  });

  it('deve retornar o profissional por id quando existir na clinica', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'staff-1', name: 'Dra. Ana' } as any);

    const result = await getStaffMemberByIdUseCase.execute('staff-1', 'tenant-1');

    expect(result).toEqual({ id: 'staff-1', name: 'Dra. Ana' });
  });

  it('deve retornar o profissional por userId quando existir na clinica', async () => {
    jest.spyOn(repository, 'findByUserId').mockResolvedValue({ id: 'staff-1', role: 'doctor' } as any);

    const result = await getStaffMemberByUserIdUseCase.execute('user-1', 'tenant-1');

    expect(repository.findByUserId).toHaveBeenCalledWith('user-1', 'tenant-1');
    expect(result).toEqual({ id: 'staff-1', role: 'doctor' });
  });

  it('deve lancar NotFoundException ao buscar profissional inexistente', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue(null);

    await expect(getStaffMemberByIdUseCase.execute('staff-404', 'tenant-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deve validar duplicidade de licenca ao atualizar profissional', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue({ id: 'staff-1' } as any);
    jest.spyOn(repository, 'findByLicenseNumber').mockResolvedValue({ id: 'staff-2' } as any);

    await expect(
      updateStaffMemberUseCase.execute('staff-1', 'tenant-1', { licenseNumber: 'CRM-123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('deve impedir inativacao do ultimo owner ativo', async () => {
    jest.spyOn(repository, 'findById').mockResolvedValue({
      id: 'staff-1',
      role: 'owner',
      status: 'active',
    } as any);
    jest.spyOn(repository, 'countActiveByRole').mockResolvedValue(1);

    await expect(
      changeStaffMemberStatusUseCase.execute('staff-1', 'tenant-1', 'inactive'),
    ).rejects.toThrow(BadRequestException);
  });
});
