import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { ChangeStaffMemberStatusUseCase } from './application/use-cases/change-staff-member-status.use-case';
import { AcceptStaffInvitationUseCase } from './application/use-cases/accept-staff-invitation.use-case';
import { CleanupExpiredStaffInvitationsUseCase } from './application/use-cases/cleanup-expired-staff-invitations.use-case';
import { CreateStaffMemberUseCase } from './application/use-cases/create-staff-member.use-case';
import { CreateStaffInvitationUseCase } from './application/use-cases/create-staff-invitation.use-case';
import { GetStaffMemberByIdUseCase } from './application/use-cases/get-staff-member-by-id.use-case';
import { GetMyStaffContextUseCase } from './application/use-cases/get-my-staff-context.use-case';
import { GetStaffMemberByUserIdUseCase } from './application/use-cases/get-staff-member-by-user-id.use-case';
import { ListStaffAuditLogsUseCase } from './application/use-cases/list-staff-audit-logs.use-case';
import { ListPendingStaffInvitationsUseCase } from './application/use-cases/list-pending-staff-invitations.use-case';
import { ListStaffMembersUseCase } from './application/use-cases/list-staff-members.use-case';
import { RevokeStaffInvitationUseCase } from './application/use-cases/revoke-staff-invitation.use-case';
import { UpdateStaffMemberUseCase } from './application/use-cases/update-staff-member.use-case';
import { StaffInvitationCleanupService } from './infrastructure/cleanup/staff-invitation-cleanup.service';
import { PrismaStaffAuditLogAdapter } from './infrastructure/persistence/prisma-staff-audit-log.adapter';
import { PrismaStaffRepository } from './infrastructure/persistence/prisma-staff.repository';
import { StaffController } from './presentation/http/staff.controller';
import { STAFF_AUDIT_LOG_PORT, STAFF_REPOSITORY } from './staff.tokens';

@Module({
  controllers: [StaffController],
  providers: [
    Reflector,
    RolesGuard,
    AcceptStaffInvitationUseCase,
    CleanupExpiredStaffInvitationsUseCase,
    CreateStaffMemberUseCase,
    CreateStaffInvitationUseCase,
    GetMyStaffContextUseCase,
    ListStaffMembersUseCase,
    ListPendingStaffInvitationsUseCase,
    ListStaffAuditLogsUseCase,
    RevokeStaffInvitationUseCase,
    GetStaffMemberByIdUseCase,
    GetStaffMemberByUserIdUseCase,
    UpdateStaffMemberUseCase,
    ChangeStaffMemberStatusUseCase,
    StaffInvitationCleanupService,
    {
      provide: STAFF_REPOSITORY,
      useClass: PrismaStaffRepository,
    },
    {
      provide: STAFF_AUDIT_LOG_PORT,
      useClass: PrismaStaffAuditLogAdapter,
    },
  ],
  exports: [GetStaffMemberByUserIdUseCase],
})
export class StaffModule {}
