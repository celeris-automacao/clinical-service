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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaStaffRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaStaffRepository = class PrismaStaffRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async create(data) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({
            userId: data.userId,
            tenantId: data.tenantId,
        });
        return prisma.staff.create({
            data,
        });
    }
    async findAllByTenant(tenantId, filters) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staff.findMany({
            where: {
                tenantId,
                ...(filters.role ? { role: filters.role } : {}),
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.specialty ? { specialty: filters.specialty } : {}),
                ...(filters.professionalType ? { professionalType: filters.professionalType } : {}),
            },
            orderBy: [{ role: 'asc' }, { name: 'asc' }],
        });
    }
    async findById(id, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staff.findFirst({
            where: { id, tenantId },
        });
    }
    async findByUserId(userId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId, tenantId });
        return prisma.staff.findFirst({
            where: { userId, tenantId },
        });
    }
    async findByEmail(email, tenantId, excludeId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staff.findFirst({
            where: {
                email,
                tenantId,
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
        });
    }
    async findByDocument(document, tenantId, excludeId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staff.findFirst({
            where: {
                document,
                tenantId,
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
        });
    }
    async findByLicenseNumber(licenseNumber, tenantId, excludeId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staff.findFirst({
            where: {
                licenseNumber,
                tenantId,
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
        });
    }
    async update(id, tenantId, data) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        await prisma.staff.updateMany({
            where: { id, tenantId },
            data,
        });
        return this.findById(id, tenantId);
    }
    async changeStatus(id, tenantId, status) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        await prisma.staff.updateMany({
            where: { id, tenantId },
            data: { status },
        });
        return this.findById(id, tenantId);
    }
    async countActiveByRole(tenantId, role) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staff.count({
            where: {
                tenantId,
                role,
                status: 'active',
            },
        });
    }
    async countByTenant(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staff.count({
            where: { tenantId },
        });
    }
    async createInvitation(data) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({
            userId: data.invitedByUserId,
            tenantId: data.tenantId,
        });
        return prisma.staffInvitation.create({
            data,
        });
    }
    async findPendingInvitationByEmail(email, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staffInvitation.findFirst({
            where: {
                email,
                tenantId,
                status: 'pending',
            },
        });
    }
    async findPendingInvitationByDocument(document, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staffInvitation.findFirst({
            where: {
                document,
                tenantId,
                status: 'pending',
            },
        });
    }
    async findPendingInvitationByLicenseNumber(licenseNumber, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staffInvitation.findFirst({
            where: {
                licenseNumber,
                tenantId,
                status: 'pending',
            },
        });
    }
    async findPendingInvitationsByTenant(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staffInvitation.findMany({
            where: {
                tenantId,
                status: 'pending',
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findInvitationById(id, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staffInvitation.findFirst({
            where: { id, tenantId },
        });
    }
    async findInvitationByToken(token) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.staffInvitation.findFirst({
            where: { token },
        });
    }
    async acceptInvitation(token, actorUserId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({
            userId: actorUserId,
            tenantId,
        });
        return prisma.staffInvitation.updateMany({
            where: { token, tenantId },
            data: { status: 'accepted' },
        });
    }
    async revokeInvitation(id, actorUserId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({
            userId: actorUserId,
            tenantId,
        });
        await prisma.staffInvitation.updateMany({
            where: { id, tenantId },
            data: { status: 'revoked' },
        });
        return this.findInvitationById(id, tenantId);
    }
    async cleanupExpiredInvitations(referenceDate) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
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
    async findAuditLogsByTenant(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.staffAuditLog.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.PrismaStaffRepository = PrismaStaffRepository;
exports.PrismaStaffRepository = PrismaStaffRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaStaffRepository);
//# sourceMappingURL=prisma-staff.repository.js.map