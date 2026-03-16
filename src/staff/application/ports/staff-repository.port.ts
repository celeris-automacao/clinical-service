export interface StaffRepositoryPort {
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
  findAllByTenant(
    tenantId: string,
    filters: {
      role?: string;
      status?: string;
      specialty?: string;
      professionalType?: string;
    },
  ): Promise<any[]>;
  findById(id: string, tenantId: string): Promise<any | null>;
  findByUserId(userId: string, tenantId: string): Promise<any | null>;
  findByEmail(email: string, tenantId: string, excludeId?: string): Promise<any | null>;
  findByDocument(document: string, tenantId: string, excludeId?: string): Promise<any | null>;
  findByLicenseNumber(
    licenseNumber: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<any | null>;
  update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      document?: string;
      email?: string | null;
      phone?: string | null;
      professionalType?: string;
      specialty?: string;
      role?: string;
      licenseNumber?: string | null;
    },
  ): Promise<any>;
  changeStatus(id: string, tenantId: string, status: string): Promise<any>;
  countActiveByRole(tenantId: string, role: string): Promise<number>;
  createInvitation(data: {
    tenantId: string;
    email: string;
    name: string;
    professionalType: string;
    specialty: string;
    role: string;
    licenseNumber?: string;
    invitedByUserId: string;
    token: string;
    status: string;
    expiresAt: Date;
  }): Promise<any>;
  findPendingInvitationByEmail(email: string, tenantId: string): Promise<any | null>;
  findPendingInvitationByDocument(document: string, tenantId: string): Promise<any | null>;
  findPendingInvitationByLicenseNumber(
    licenseNumber: string,
    tenantId: string,
  ): Promise<any | null>;
  findPendingInvitationsByTenant(tenantId: string): Promise<any[]>;
  findInvitationById(id: string, tenantId: string): Promise<any | null>;
  findInvitationByToken(token: string): Promise<any | null>;
  acceptInvitation(token: string, actorUserId: string, tenantId: string): Promise<any>;
  revokeInvitation(id: string, actorUserId: string, tenantId: string): Promise<any>;
  cleanupExpiredInvitations(referenceDate: Date): Promise<number>;
  findAuditLogsByTenant(tenantId: string): Promise<any[]>;
}
