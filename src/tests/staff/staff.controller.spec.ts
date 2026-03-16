import { Test, TestingModule } from '@nestjs/testing';
import { AcceptStaffInvitationUseCase } from '../../staff/application/use-cases/accept-staff-invitation.use-case';
import { ChangeStaffMemberStatusUseCase } from '../../staff/application/use-cases/change-staff-member-status.use-case';
import { CleanupExpiredStaffInvitationsUseCase } from '../../staff/application/use-cases/cleanup-expired-staff-invitations.use-case';
import { CreateStaffInvitationUseCase } from '../../staff/application/use-cases/create-staff-invitation.use-case';
import { CreateStaffMemberUseCase } from '../../staff/application/use-cases/create-staff-member.use-case';
import { GetMyStaffContextUseCase } from '../../staff/application/use-cases/get-my-staff-context.use-case';
import { GetStaffMemberByIdUseCase } from '../../staff/application/use-cases/get-staff-member-by-id.use-case';
import { ListPendingStaffInvitationsUseCase } from '../../staff/application/use-cases/list-pending-staff-invitations.use-case';
import { ListStaffAuditLogsUseCase } from '../../staff/application/use-cases/list-staff-audit-logs.use-case';
import { ListStaffMembersUseCase } from '../../staff/application/use-cases/list-staff-members.use-case';
import { RevokeStaffInvitationUseCase } from '../../staff/application/use-cases/revoke-staff-invitation.use-case';
import { UpdateStaffMemberUseCase } from '../../staff/application/use-cases/update-staff-member.use-case';
import { StaffController } from '../../staff/presentation/http/staff.controller';

describe('StaffController', () => {
  let controller: StaffController;
  let createStaffMemberUseCase: CreateStaffMemberUseCase;
  let acceptStaffInvitationUseCase: AcceptStaffInvitationUseCase;
  let cleanupExpiredStaffInvitationsUseCase: CleanupExpiredStaffInvitationsUseCase;
  let createStaffInvitationUseCase: CreateStaffInvitationUseCase;
  let getMyStaffContextUseCase: GetMyStaffContextUseCase;
  let listPendingStaffInvitationsUseCase: ListPendingStaffInvitationsUseCase;
  let listStaffMembersUseCase: ListStaffMembersUseCase;
  let listStaffAuditLogsUseCase: ListStaffAuditLogsUseCase;
  let revokeStaffInvitationUseCase: RevokeStaffInvitationUseCase;
  let getStaffMemberByIdUseCase: GetStaffMemberByIdUseCase;
  let updateStaffMemberUseCase: UpdateStaffMemberUseCase;
  let changeStaffMemberStatusUseCase: ChangeStaffMemberStatusUseCase;

  const mockUser = { userId: 'user-1', tenantId: 'tenant-1', role: 'admin', email: 'admin@test.com' };
  const mockPatientUser = { userId: 'user-2', tenantId: 'tenant-1', role: 'patient', email: 'ana@test.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [
        { provide: CreateStaffMemberUseCase, useValue: { execute: jest.fn() } },
        { provide: AcceptStaffInvitationUseCase, useValue: { execute: jest.fn() } },
        { provide: CleanupExpiredStaffInvitationsUseCase, useValue: { execute: jest.fn() } },
        { provide: CreateStaffInvitationUseCase, useValue: { execute: jest.fn() } },
        { provide: GetMyStaffContextUseCase, useValue: { execute: jest.fn() } },
        { provide: ListPendingStaffInvitationsUseCase, useValue: { execute: jest.fn() } },
        { provide: ListStaffMembersUseCase, useValue: { execute: jest.fn() } },
        { provide: ListStaffAuditLogsUseCase, useValue: { execute: jest.fn() } },
        { provide: RevokeStaffInvitationUseCase, useValue: { execute: jest.fn() } },
        { provide: GetStaffMemberByIdUseCase, useValue: { execute: jest.fn() } },
        { provide: UpdateStaffMemberUseCase, useValue: { execute: jest.fn() } },
        { provide: ChangeStaffMemberStatusUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get<StaffController>(StaffController);
    createStaffMemberUseCase = module.get<CreateStaffMemberUseCase>(CreateStaffMemberUseCase);
    acceptStaffInvitationUseCase = module.get<AcceptStaffInvitationUseCase>(AcceptStaffInvitationUseCase);
    cleanupExpiredStaffInvitationsUseCase = module.get<CleanupExpiredStaffInvitationsUseCase>(
      CleanupExpiredStaffInvitationsUseCase,
    );
    createStaffInvitationUseCase = module.get<CreateStaffInvitationUseCase>(CreateStaffInvitationUseCase);
    getMyStaffContextUseCase = module.get<GetMyStaffContextUseCase>(GetMyStaffContextUseCase);
    listPendingStaffInvitationsUseCase = module.get<ListPendingStaffInvitationsUseCase>(
      ListPendingStaffInvitationsUseCase,
    );
    listStaffMembersUseCase = module.get<ListStaffMembersUseCase>(ListStaffMembersUseCase);
    listStaffAuditLogsUseCase = module.get<ListStaffAuditLogsUseCase>(ListStaffAuditLogsUseCase);
    revokeStaffInvitationUseCase = module.get<RevokeStaffInvitationUseCase>(RevokeStaffInvitationUseCase);
    getStaffMemberByIdUseCase = module.get<GetStaffMemberByIdUseCase>(GetStaffMemberByIdUseCase);
    updateStaffMemberUseCase = module.get<UpdateStaffMemberUseCase>(UpdateStaffMemberUseCase);
    changeStaffMemberStatusUseCase = module.get<ChangeStaffMemberStatusUseCase>(
      ChangeStaffMemberStatusUseCase,
    );
  });

  it('deve delegar create para o use case com tenantId e actor', async () => {
    const dto = {
      userId: '9cbf5f90-cb9d-4cb1-b9f2-761e9e57b9ab',
      name: 'Dra. Ana',
      document: '12345678900',
      professionalType: 'doctor',
      specialty: 'clinica geral',
      role: 'doctor',
    };

    await controller.create(dto as any, mockUser as any);

    expect(createStaffMemberUseCase.execute).toHaveBeenCalledWith(dto, 'tenant-1', 'user-1');
  });

  it('deve delegar convite ao use case', async () => {
    const dto = {
      email: 'ana@test.com',
      name: 'Dra. Ana',
      document: '12345678900',
      professionalType: 'doctor',
      specialty: 'clinica geral',
      role: 'doctor',
    };

    await controller.invite(dto as any, mockUser as any);

    expect(createStaffInvitationUseCase.execute).toHaveBeenCalledWith(dto, 'tenant-1', 'user-1');
  });

  it('deve delegar aceite do convite ao use case', async () => {
    const dto = { token: 'token-1' };

    await controller.acceptInvitation(dto, mockPatientUser as any);

    expect(acceptStaffInvitationUseCase.execute).toHaveBeenCalledWith(dto, mockPatientUser);
  });

  it('deve delegar meu contexto ao use case', async () => {
    await controller.getMyContext(mockPatientUser as any);

    expect(getMyStaffContextUseCase.execute).toHaveBeenCalledWith(mockPatientUser);
  });

  it('deve delegar listagem de convites pendentes ao use case', async () => {
    await controller.listPendingInvitations(mockUser as any);

    expect(listPendingStaffInvitationsUseCase.execute).toHaveBeenCalledWith('tenant-1');
  });

  it('deve delegar listagem com filtros ao use case', async () => {
    const filters = { role: 'doctor', status: 'active' };

    await controller.findAll(filters as any, mockUser as any);

    expect(listStaffMembersUseCase.execute).toHaveBeenCalledWith('tenant-1', filters);
  });

  it('deve delegar listagem de auditoria ao use case', async () => {
    await controller.listAuditLogs(mockUser as any);

    expect(listStaffAuditLogsUseCase.execute).toHaveBeenCalledWith('tenant-1');
  });

  it('deve delegar busca por id ao use case', async () => {
    await controller.findOne('staff-1', mockUser as any);

    expect(getStaffMemberByIdUseCase.execute).toHaveBeenCalledWith('staff-1', 'tenant-1');
  });

  it('deve delegar update ao use case', async () => {
    const dto = { specialty: 'cardiologia' };

    await controller.update('staff-1', dto as any, mockUser as any);

    expect(updateStaffMemberUseCase.execute).toHaveBeenCalledWith(
      'staff-1',
      'tenant-1',
      dto,
      'user-1',
    );
  });

  it('deve delegar alteracao de status ao use case', async () => {
    await controller.changeStatus('staff-1', { status: 'inactive' } as any, mockUser as any);

    expect(changeStaffMemberStatusUseCase.execute).toHaveBeenCalledWith(
      'staff-1',
      'tenant-1',
      'inactive',
      'user-1',
    );
  });

  it('deve delegar revogacao de convite ao use case', async () => {
    await controller.revokeInvitation('invite-1', mockUser as any);

    expect(revokeStaffInvitationUseCase.execute).toHaveBeenCalledWith(
      'invite-1',
      'tenant-1',
      'user-1',
    );
  });

  it('deve delegar cleanup ao use case', async () => {
    await controller.cleanupExpiredInvitations();

    expect(cleanupExpiredStaffInvitationsUseCase.execute).toHaveBeenCalled();
  });
});
