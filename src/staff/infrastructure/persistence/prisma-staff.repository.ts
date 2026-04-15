import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { StaffRepositoryPort } from '../../application/ports/staff-repository.port';

@Injectable()
export class PrismaStaffRepository implements StaffRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async create(data: {
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
  }) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({
      userId: data.userId,
      tenantId: data.tenantId,
    }) as any;

    return prisma.staff.create({
      data,
    });
  }

  async findAllByTenant(
    tenantId: string,
    filters: {
      role?: string;
      status?: string;
      specialty?: string;
      professionalType?: string;
    },
  ) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staff.findMany({
      where: {
        tenantId,
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.specialty ? { specialty: filters.specialty } : {}),
        ...(filters.professionalType ? { professionalType: filters.professionalType } : {}),
      },
      include: {
        ...(filters.includePatients
          ? {
              patients: {
                include: {
                  clinicalRecords: {
                    orderBy: { recordedAt: 'desc' },
                  },
                },
              },
            }
          : {}),
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staff.findFirst({
      where: { id, tenantId },
    });
  }

  async findByUserId(userId: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId, tenantId }) as any;
    return prisma.staff.findFirst({
      where: { userId, tenantId },
    });
  }

  async findByEmail(email: string, tenantId: string, excludeId?: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staff.findFirst({
      where: {
        email,
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findByDocument(document: string, tenantId: string, excludeId?: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staff.findFirst({
      where: {
        document,
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async findByLicenseNumber(licenseNumber: string, tenantId: string, excludeId?: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staff.findFirst({
      where: {
        licenseNumber,
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async update(
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
  ) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    await prisma.staff.updateMany({
      where: { id, tenantId },
      data,
    });
    return this.findById(id, tenantId);
  }

  async changeStatus(id: string, tenantId: string, status: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    await prisma.staff.updateMany({
      where: { id, tenantId },
      data: { status },
    });
    return this.findById(id, tenantId);
  }

  async countActiveByRole(tenantId: string, role: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staff.count({
      where: {
        tenantId,
        role,
        status: 'active',
      },
    });
  }

  async countByTenant(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staff.count({
      where: { tenantId },
    });
  }

  async createInvitation(data: {
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
  }) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({
      userId: data.invitedByUserId,
      tenantId: data.tenantId,
    }) as any;
    return prisma.staffInvitation.create({
      data,
    });
  }

  async findPendingInvitationByEmail(email: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staffInvitation.findFirst({
      where: {
        email,
        tenantId,
        status: 'pending',
      },
    });
  }

  async findPendingInvitationByDocument(document: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staffInvitation.findFirst({
      where: {
        document,
        tenantId,
        status: 'pending',
      },
    });
  }

  async findPendingInvitationByLicenseNumber(licenseNumber: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staffInvitation.findFirst({
      where: {
        licenseNumber,
        tenantId,
        status: 'pending',
      },
    });
  }

  async findPendingInvitationsByTenant(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staffInvitation.findMany({
      where: {
        tenantId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInvitationById(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staffInvitation.findFirst({
      where: { id, tenantId },
    });
  }

  async findInvitationByToken(token: string) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    return prisma.staffInvitation.findFirst({
      where: { token },
    });
  }

  async acceptInvitation(token: string, actorUserId: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({
      userId: actorUserId,
      tenantId,
    }) as any;
    return prisma.staffInvitation.updateMany({
      where: { token, tenantId },
      data: { status: 'accepted' },
    });
  }

  async revokeInvitation(id: string, actorUserId: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({
      userId: actorUserId,
      tenantId,
    }) as any;
    await prisma.staffInvitation.updateMany({
      where: { id, tenantId },
      data: { status: 'revoked' },
    });
    return this.findInvitationById(id, tenantId);
  }

  async cleanupExpiredInvitations(referenceDate: Date) {
    const prisma = this.tenantScopedPrismaFactory.forRoot() as any;
    const result = await prisma.staffInvitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: referenceDate },
      },
      data: {
        status: 'expired',
      },
    });
    return result.count ?? 0;
  }

  async findAuditLogsByTenant(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId) as any;
    return prisma.staffAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
