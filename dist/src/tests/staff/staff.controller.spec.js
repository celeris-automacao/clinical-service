"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const accept_staff_invitation_use_case_1 = require("../../staff/application/use-cases/accept-staff-invitation.use-case");
const change_staff_member_status_use_case_1 = require("../../staff/application/use-cases/change-staff-member-status.use-case");
const cleanup_expired_staff_invitations_use_case_1 = require("../../staff/application/use-cases/cleanup-expired-staff-invitations.use-case");
const create_staff_invitation_use_case_1 = require("../../staff/application/use-cases/create-staff-invitation.use-case");
const create_staff_member_use_case_1 = require("../../staff/application/use-cases/create-staff-member.use-case");
const get_my_staff_context_use_case_1 = require("../../staff/application/use-cases/get-my-staff-context.use-case");
const get_staff_member_by_id_use_case_1 = require("../../staff/application/use-cases/get-staff-member-by-id.use-case");
const list_pending_staff_invitations_use_case_1 = require("../../staff/application/use-cases/list-pending-staff-invitations.use-case");
const list_staff_audit_logs_use_case_1 = require("../../staff/application/use-cases/list-staff-audit-logs.use-case");
const list_staff_members_use_case_1 = require("../../staff/application/use-cases/list-staff-members.use-case");
const revoke_staff_invitation_use_case_1 = require("../../staff/application/use-cases/revoke-staff-invitation.use-case");
const update_staff_member_use_case_1 = require("../../staff/application/use-cases/update-staff-member.use-case");
const staff_controller_1 = require("../../staff/presentation/http/staff.controller");
describe('StaffController', () => {
    let controller;
    let createStaffMemberUseCase;
    let acceptStaffInvitationUseCase;
    let cleanupExpiredStaffInvitationsUseCase;
    let createStaffInvitationUseCase;
    let getMyStaffContextUseCase;
    let listPendingStaffInvitationsUseCase;
    let listStaffMembersUseCase;
    let listStaffAuditLogsUseCase;
    let revokeStaffInvitationUseCase;
    let getStaffMemberByIdUseCase;
    let updateStaffMemberUseCase;
    let changeStaffMemberStatusUseCase;
    const mockUser = { userId: 'user-1', tenantId: 'tenant-1', role: 'admin', email: 'admin@test.com' };
    const mockPatientUser = { userId: 'user-2', tenantId: 'tenant-1', role: 'patient', email: 'ana@test.com' };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [staff_controller_1.StaffController],
            providers: [
                { provide: create_staff_member_use_case_1.CreateStaffMemberUseCase, useValue: { execute: jest.fn() } },
                { provide: accept_staff_invitation_use_case_1.AcceptStaffInvitationUseCase, useValue: { execute: jest.fn() } },
                { provide: cleanup_expired_staff_invitations_use_case_1.CleanupExpiredStaffInvitationsUseCase, useValue: { execute: jest.fn() } },
                { provide: create_staff_invitation_use_case_1.CreateStaffInvitationUseCase, useValue: { execute: jest.fn() } },
                { provide: get_my_staff_context_use_case_1.GetMyStaffContextUseCase, useValue: { execute: jest.fn() } },
                { provide: list_pending_staff_invitations_use_case_1.ListPendingStaffInvitationsUseCase, useValue: { execute: jest.fn() } },
                { provide: list_staff_members_use_case_1.ListStaffMembersUseCase, useValue: { execute: jest.fn() } },
                { provide: list_staff_audit_logs_use_case_1.ListStaffAuditLogsUseCase, useValue: { execute: jest.fn() } },
                { provide: revoke_staff_invitation_use_case_1.RevokeStaffInvitationUseCase, useValue: { execute: jest.fn() } },
                { provide: get_staff_member_by_id_use_case_1.GetStaffMemberByIdUseCase, useValue: { execute: jest.fn() } },
                { provide: update_staff_member_use_case_1.UpdateStaffMemberUseCase, useValue: { execute: jest.fn() } },
                { provide: change_staff_member_status_use_case_1.ChangeStaffMemberStatusUseCase, useValue: { execute: jest.fn() } },
            ],
        }).compile();
        controller = module.get(staff_controller_1.StaffController);
        createStaffMemberUseCase = module.get(create_staff_member_use_case_1.CreateStaffMemberUseCase);
        acceptStaffInvitationUseCase = module.get(accept_staff_invitation_use_case_1.AcceptStaffInvitationUseCase);
        cleanupExpiredStaffInvitationsUseCase = module.get(cleanup_expired_staff_invitations_use_case_1.CleanupExpiredStaffInvitationsUseCase);
        createStaffInvitationUseCase = module.get(create_staff_invitation_use_case_1.CreateStaffInvitationUseCase);
        getMyStaffContextUseCase = module.get(get_my_staff_context_use_case_1.GetMyStaffContextUseCase);
        listPendingStaffInvitationsUseCase = module.get(list_pending_staff_invitations_use_case_1.ListPendingStaffInvitationsUseCase);
        listStaffMembersUseCase = module.get(list_staff_members_use_case_1.ListStaffMembersUseCase);
        listStaffAuditLogsUseCase = module.get(list_staff_audit_logs_use_case_1.ListStaffAuditLogsUseCase);
        revokeStaffInvitationUseCase = module.get(revoke_staff_invitation_use_case_1.RevokeStaffInvitationUseCase);
        getStaffMemberByIdUseCase = module.get(get_staff_member_by_id_use_case_1.GetStaffMemberByIdUseCase);
        updateStaffMemberUseCase = module.get(update_staff_member_use_case_1.UpdateStaffMemberUseCase);
        changeStaffMemberStatusUseCase = module.get(change_staff_member_status_use_case_1.ChangeStaffMemberStatusUseCase);
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
        await controller.create(dto, mockUser);
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
        await controller.invite(dto, mockUser);
        expect(createStaffInvitationUseCase.execute).toHaveBeenCalledWith(dto, 'tenant-1', 'user-1');
    });
    it('deve delegar aceite do convite ao use case', async () => {
        const dto = { token: 'token-1' };
        await controller.acceptInvitation(dto, mockPatientUser);
        expect(acceptStaffInvitationUseCase.execute).toHaveBeenCalledWith(dto, mockPatientUser);
    });
    it('deve delegar meu contexto ao use case', async () => {
        await controller.getMyContext(mockPatientUser);
        expect(getMyStaffContextUseCase.execute).toHaveBeenCalledWith(mockPatientUser);
    });
    it('deve delegar listagem de convites pendentes ao use case', async () => {
        await controller.listPendingInvitations(mockUser);
        expect(listPendingStaffInvitationsUseCase.execute).toHaveBeenCalledWith('tenant-1');
    });
    it('deve delegar listagem com filtros ao use case', async () => {
        const filters = { role: 'doctor', status: 'active' };
        await controller.findAll(filters, mockUser);
        expect(listStaffMembersUseCase.execute).toHaveBeenCalledWith('tenant-1', filters);
    });
    it('deve delegar listagem de auditoria ao use case', async () => {
        await controller.listAuditLogs(mockUser);
        expect(listStaffAuditLogsUseCase.execute).toHaveBeenCalledWith('tenant-1');
    });
    it('deve delegar busca por id ao use case', async () => {
        await controller.findOne('staff-1', mockUser);
        expect(getStaffMemberByIdUseCase.execute).toHaveBeenCalledWith('staff-1', 'tenant-1');
    });
    it('deve delegar update ao use case', async () => {
        const dto = { specialty: 'cardiologia' };
        await controller.update('staff-1', dto, mockUser);
        expect(updateStaffMemberUseCase.execute).toHaveBeenCalledWith('staff-1', 'tenant-1', dto, 'user-1');
    });
    it('deve delegar alteracao de status ao use case', async () => {
        await controller.changeStatus('staff-1', { status: 'inactive' }, mockUser);
        expect(changeStaffMemberStatusUseCase.execute).toHaveBeenCalledWith('staff-1', 'tenant-1', 'inactive', 'user-1');
    });
    it('deve delegar revogacao de convite ao use case', async () => {
        await controller.revokeInvitation('invite-1', mockUser);
        expect(revokeStaffInvitationUseCase.execute).toHaveBeenCalledWith('invite-1', 'tenant-1', 'user-1');
    });
    it('deve delegar cleanup ao use case', async () => {
        await controller.cleanupExpiredInvitations();
        expect(cleanupExpiredStaffInvitationsUseCase.execute).toHaveBeenCalled();
    });
});
//# sourceMappingURL=staff.controller.spec.js.map