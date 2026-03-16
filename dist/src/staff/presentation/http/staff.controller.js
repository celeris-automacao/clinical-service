"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const change_staff_member_status_use_case_1 = require("../../application/use-cases/change-staff-member-status.use-case");
const accept_staff_invitation_use_case_1 = require("../../application/use-cases/accept-staff-invitation.use-case");
const cleanup_expired_staff_invitations_use_case_1 = require("../../application/use-cases/cleanup-expired-staff-invitations.use-case");
const create_staff_member_use_case_1 = require("../../application/use-cases/create-staff-member.use-case");
const create_staff_invitation_use_case_1 = require("../../application/use-cases/create-staff-invitation.use-case");
const get_staff_member_by_id_use_case_1 = require("../../application/use-cases/get-staff-member-by-id.use-case");
const get_my_staff_context_use_case_1 = require("../../application/use-cases/get-my-staff-context.use-case");
const list_staff_audit_logs_use_case_1 = require("../../application/use-cases/list-staff-audit-logs.use-case");
const list_pending_staff_invitations_use_case_1 = require("../../application/use-cases/list-pending-staff-invitations.use-case");
const list_staff_members_use_case_1 = require("../../application/use-cases/list-staff-members.use-case");
const revoke_staff_invitation_use_case_1 = require("../../application/use-cases/revoke-staff-invitation.use-case");
const update_staff_member_use_case_1 = require("../../application/use-cases/update-staff-member.use-case");
const change_staff_member_status_dto_1 = require("./dto/change-staff-member-status.dto");
const accept_staff_invitation_dto_1 = require("./dto/accept-staff-invitation.dto");
const create_staff_member_dto_1 = require("./dto/create-staff-member.dto");
const create_staff_invitation_dto_1 = require("./dto/create-staff-invitation.dto");
const list_staff_members_dto_1 = require("./dto/list-staff-members.dto");
const update_staff_member_dto_1 = require("./dto/update-staff-member.dto");
let StaffController = class StaffController {
    constructor(createStaffMemberUseCase, acceptStaffInvitationUseCase, cleanupExpiredStaffInvitationsUseCase, createStaffInvitationUseCase, getMyStaffContextUseCase, listStaffMembersUseCase, listPendingStaffInvitationsUseCase, listStaffAuditLogsUseCase, revokeStaffInvitationUseCase, getStaffMemberByIdUseCase, updateStaffMemberUseCase, changeStaffMemberStatusUseCase) {
        this.createStaffMemberUseCase = createStaffMemberUseCase;
        this.acceptStaffInvitationUseCase = acceptStaffInvitationUseCase;
        this.cleanupExpiredStaffInvitationsUseCase = cleanupExpiredStaffInvitationsUseCase;
        this.createStaffInvitationUseCase = createStaffInvitationUseCase;
        this.getMyStaffContextUseCase = getMyStaffContextUseCase;
        this.listStaffMembersUseCase = listStaffMembersUseCase;
        this.listPendingStaffInvitationsUseCase = listPendingStaffInvitationsUseCase;
        this.listStaffAuditLogsUseCase = listStaffAuditLogsUseCase;
        this.revokeStaffInvitationUseCase = revokeStaffInvitationUseCase;
        this.getStaffMemberByIdUseCase = getStaffMemberByIdUseCase;
        this.updateStaffMemberUseCase = updateStaffMemberUseCase;
        this.changeStaffMemberStatusUseCase = changeStaffMemberStatusUseCase;
    }
    create(dto, user) {
        return this.createStaffMemberUseCase.execute(dto, user.tenantId, user.userId);
    }
    invite(dto, user) {
        return this.createStaffInvitationUseCase.execute(dto, user.tenantId, user.userId);
    }
    acceptInvitation(dto, user) {
        return this.acceptStaffInvitationUseCase.execute(dto, user);
    }
    getMyContext(user) {
        return this.getMyStaffContextUseCase.execute(user);
    }
    listPendingInvitations(user) {
        return this.listPendingStaffInvitationsUseCase.execute(user.tenantId);
    }
    findAll(filters, user) {
        return this.listStaffMembersUseCase.execute(user.tenantId, filters);
    }
    listAuditLogs(user) {
        return this.listStaffAuditLogsUseCase.execute(user.tenantId);
    }
    findOne(id, user) {
        return this.getStaffMemberByIdUseCase.execute(id, user.tenantId);
    }
    update(id, dto, user) {
        return this.updateStaffMemberUseCase.execute(id, user.tenantId, dto, user.userId);
    }
    changeStatus(id, dto, user) {
        return this.changeStaffMemberStatusUseCase.execute(id, user.tenantId, dto.status, user.userId);
    }
    revokeInvitation(id, user) {
        return this.revokeStaffInvitationUseCase.execute(id, user.tenantId, user.userId);
    }
    cleanupExpiredInvitations() {
        return this.cleanupExpiredStaffInvitationsUseCase.execute();
    }
};
exports.StaffController = StaffController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_staff_member_dto_1.CreateStaffMemberDto, Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('invitations'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_staff_invitation_dto_1.CreateStaffInvitationDto, Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "invite", null);
__decorate([
    (0, common_1.Post)('invitations/accept'),
    (0, roles_decorator_1.Roles)('patient', 'owner', 'admin', 'doctor', 'specialist', 'staff'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [accept_staff_invitation_dto_1.AcceptStaffInvitationDto, Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "acceptInvitation", null);
__decorate([
    (0, common_1.Get)('me/context'),
    (0, roles_decorator_1.Roles)('patient', 'owner', 'admin', 'doctor', 'specialist', 'staff'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "getMyContext", null);
__decorate([
    (0, common_1.Get)('invitations/pending'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "listPendingInvitations", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_staff_members_dto_1.ListStaffMembersDto, Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('audit-logs'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "listAuditLogs", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_staff_member_dto_1.UpdateStaffMemberDto, Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, change_staff_member_status_dto_1.ChangeStaffMemberStatusDto, Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "changeStatus", null);
__decorate([
    (0, common_1.Patch)('invitations/:id/revoke'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "revokeInvitation", null);
__decorate([
    (0, common_1.Post)('invitations/cleanup'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StaffController.prototype, "cleanupExpiredInvitations", null);
exports.StaffController = StaffController = __decorate([
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('owner', 'admin'),
    (0, common_1.Controller)('staff'),
    __metadata("design:paramtypes", [create_staff_member_use_case_1.CreateStaffMemberUseCase,
        accept_staff_invitation_use_case_1.AcceptStaffInvitationUseCase,
        cleanup_expired_staff_invitations_use_case_1.CleanupExpiredStaffInvitationsUseCase,
        create_staff_invitation_use_case_1.CreateStaffInvitationUseCase,
        get_my_staff_context_use_case_1.GetMyStaffContextUseCase,
        list_staff_members_use_case_1.ListStaffMembersUseCase,
        list_pending_staff_invitations_use_case_1.ListPendingStaffInvitationsUseCase,
        list_staff_audit_logs_use_case_1.ListStaffAuditLogsUseCase,
        revoke_staff_invitation_use_case_1.RevokeStaffInvitationUseCase,
        get_staff_member_by_id_use_case_1.GetStaffMemberByIdUseCase,
        update_staff_member_use_case_1.UpdateStaffMemberUseCase,
        change_staff_member_status_use_case_1.ChangeStaffMemberStatusUseCase])
], StaffController);
//# sourceMappingURL=staff.controller.js.map