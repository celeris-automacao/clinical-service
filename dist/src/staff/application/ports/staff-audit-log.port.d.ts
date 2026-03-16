export interface StaffAuditLogPort {
    create(input: {
        tenantId: string;
        actorUserId: string;
        targetStaffId?: string;
        action: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
}
