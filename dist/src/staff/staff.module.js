"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_guard_1 = require("../common/guards/roles.guard");
const change_staff_member_status_use_case_1 = require("./application/use-cases/change-staff-member-status.use-case");
const accept_staff_invitation_use_case_1 = require("./application/use-cases/accept-staff-invitation.use-case");
const cleanup_expired_staff_invitations_use_case_1 = require("./application/use-cases/cleanup-expired-staff-invitations.use-case");
const create_staff_member_use_case_1 = require("./application/use-cases/create-staff-member.use-case");
const create_staff_invitation_use_case_1 = require("./application/use-cases/create-staff-invitation.use-case");
const get_staff_member_by_id_use_case_1 = require("./application/use-cases/get-staff-member-by-id.use-case");
const get_my_staff_context_use_case_1 = require("./application/use-cases/get-my-staff-context.use-case");
const get_staff_member_by_user_id_use_case_1 = require("./application/use-cases/get-staff-member-by-user-id.use-case");
const list_staff_audit_logs_use_case_1 = require("./application/use-cases/list-staff-audit-logs.use-case");
const list_pending_staff_invitations_use_case_1 = require("./application/use-cases/list-pending-staff-invitations.use-case");
const list_staff_members_use_case_1 = require("./application/use-cases/list-staff-members.use-case");
const revoke_staff_invitation_use_case_1 = require("./application/use-cases/revoke-staff-invitation.use-case");
const update_staff_member_use_case_1 = require("./application/use-cases/update-staff-member.use-case");
const staff_invitation_cleanup_service_1 = require("./infrastructure/cleanup/staff-invitation-cleanup.service");
const prisma_staff_audit_log_adapter_1 = require("./infrastructure/persistence/prisma-staff-audit-log.adapter");
const prisma_staff_repository_1 = require("./infrastructure/persistence/prisma-staff.repository");
const staff_controller_1 = require("./presentation/http/staff.controller");
const staff_tokens_1 = require("./staff.tokens");
let StaffModule = class StaffModule {
};
exports.StaffModule = StaffModule;
exports.StaffModule = StaffModule = __decorate([
    (0, common_1.Module)({
        controllers: [staff_controller_1.StaffController],
        providers: [
            core_1.Reflector,
            roles_guard_1.RolesGuard,
            accept_staff_invitation_use_case_1.AcceptStaffInvitationUseCase,
            cleanup_expired_staff_invitations_use_case_1.CleanupExpiredStaffInvitationsUseCase,
            create_staff_member_use_case_1.CreateStaffMemberUseCase,
            create_staff_invitation_use_case_1.CreateStaffInvitationUseCase,
            get_my_staff_context_use_case_1.GetMyStaffContextUseCase,
            list_staff_members_use_case_1.ListStaffMembersUseCase,
            list_pending_staff_invitations_use_case_1.ListPendingStaffInvitationsUseCase,
            list_staff_audit_logs_use_case_1.ListStaffAuditLogsUseCase,
            revoke_staff_invitation_use_case_1.RevokeStaffInvitationUseCase,
            get_staff_member_by_id_use_case_1.GetStaffMemberByIdUseCase,
            get_staff_member_by_user_id_use_case_1.GetStaffMemberByUserIdUseCase,
            update_staff_member_use_case_1.UpdateStaffMemberUseCase,
            change_staff_member_status_use_case_1.ChangeStaffMemberStatusUseCase,
            staff_invitation_cleanup_service_1.StaffInvitationCleanupService,
            {
                provide: staff_tokens_1.STAFF_REPOSITORY,
                useClass: prisma_staff_repository_1.PrismaStaffRepository,
            },
            {
                provide: staff_tokens_1.STAFF_AUDIT_LOG_PORT,
                useClass: prisma_staff_audit_log_adapter_1.PrismaStaffAuditLogAdapter,
            },
        ],
        exports: [get_staff_member_by_user_id_use_case_1.GetStaffMemberByUserIdUseCase],
    })
], StaffModule);
//# sourceMappingURL=staff.module.js.map