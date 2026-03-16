import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { StaffRepositoryPort } from '../../application/ports/staff-repository.port';
export declare class PrismaStaffRepository implements StaffRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    create(data: {
        tenantId: string;
        userId: string;
        name: string;
        document: string;
        email?: string;
        phone?: string;
        professionalType: string;
        specialty: string;
        role: string;
        licenseNumber?: string;
        status: string;
    }): Promise<any>;
    findAllByTenant(tenantId: string, filters: {
        role?: string;
        status?: string;
        specialty?: string;
        professionalType?: string;
    }): Promise<any>;
    findById(id: string, tenantId: string): Promise<any>;
    findByUserId(userId: string, tenantId: string): Promise<any>;
    findByEmail(email: string, tenantId: string, excludeId?: string): Promise<any>;
    findByDocument(document: string, tenantId: string, excludeId?: string): Promise<any>;
    findByLicenseNumber(licenseNumber: string, tenantId: string, excludeId?: string): Promise<any>;
    update(id: string, tenantId: string, data: {
        name?: string;
        document?: string;
        email?: string | null;
        phone?: string | null;
        professionalType?: string;
        specialty?: string;
        role?: string;
        licenseNumber?: string | null;
    }): Promise<any>;
    changeStatus(id: string, tenantId: string, status: string): Promise<any>;
    countActiveByRole(tenantId: string, role: string): Promise<any>;
    countByTenant(tenantId: string): Promise<any>;
    createInvitation(data: {
        tenantId: string;
        email: string;
        name: string;
        document: string;
        professionalType: string;
        specialty: string;
        role: string;
        licenseNumber?: string;
        invitedByUserId: string;
        token: string;
        status: string;
        expiresAt: Date;
    }): Promise<any>;
    findPendingInvitationByEmail(email: string, tenantId: string): Promise<any>;
    findPendingInvitationByDocument(document: string, tenantId: string): Promise<any>;
    findPendingInvitationByLicenseNumber(licenseNumber: string, tenantId: string): Promise<any>;
    findPendingInvitationsByTenant(tenantId: string): Promise<any>;
    findInvitationById(id: string, tenantId: string): Promise<any>;
    findInvitationByToken(token: string): Promise<any>;
    acceptInvitation(token: string, actorUserId: string, tenantId: string): Promise<any>;
    revokeInvitation(id: string, actorUserId: string, tenantId: string): Promise<any>;
    cleanupExpiredInvitations(referenceDate: Date): Promise<any>;
    findAuditLogsByTenant(tenantId: string): Promise<any>;
}
