import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CleanupExpiredStaffInvitationsUseCase } from '../../application/use-cases/cleanup-expired-staff-invitations.use-case';
export declare class StaffInvitationCleanupService implements OnModuleInit, OnModuleDestroy {
    private readonly cleanupExpiredStaffInvitationsUseCase;
    private intervalRef?;
    constructor(cleanupExpiredStaffInvitationsUseCase: CleanupExpiredStaffInvitationsUseCase);
    onModuleInit(): void;
    onModuleDestroy(): void;
}
