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
exports.PrismaTasksRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scope_1 = require("../../../shared/infrastructure/persistence/tenant-scope");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaTasksRepository = class PrismaTasksRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async createTemplate(data) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(data.tenantId);
        return prisma.taskTemplate.create({ data });
    }
    async findTemplateByTitleAndType(title, taskType, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.taskTemplate.findFirst({
            where: (0, tenant_scope_1.byTenant)(tenantId, { title, taskType }),
        });
    }
    async findTemplateById(id, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.taskTemplate.findFirst({
            where: (0, tenant_scope_1.byIdAndTenant)(id, tenantId),
        });
    }
    async listTemplatesByTenant(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.taskTemplate.findMany({
            where: (0, tenant_scope_1.byTenant)(tenantId),
            orderBy: [{ isActive: 'desc' }, { title: 'asc' }],
        });
    }
    async createAssignment(data) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(data.tenantId);
        return prisma.taskAssignment.create({
            data: {
                ...data,
                status: 'pending',
            },
            include: {
                template: true,
            },
        });
    }
    async findAssignmentsByPatient(patientId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
        return prisma.taskAssignment.findMany({
            where: (0, tenant_scope_1.byTenant)(tenantId, { patientId }),
            include: { template: true },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        });
    }
    async findAssignmentsByPatientOnDate(patientId, tenantId, dueDate) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
        return prisma.taskAssignment.findMany({
            where: (0, tenant_scope_1.byTenant)(tenantId, { patientId, dueDate }),
            include: { template: true },
            orderBy: { createdAt: 'asc' },
        });
    }
    async findAssignmentById(id, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.taskAssignment.findFirst({
            where: (0, tenant_scope_1.byIdAndTenant)(id, tenantId),
            include: { template: true },
        });
    }
    async findPatientById(patientId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.patient.findFirst({
            where: (0, tenant_scope_1.byIdAndTenant)(patientId, tenantId),
            select: { id: true },
        });
    }
    async findActiveAssignment(input) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(input.tenantId);
        return prisma.taskAssignment.findFirst({
            where: {
                ...(0, tenant_scope_1.byTenant)(input.tenantId, {
                    patientId: input.patientId,
                    templateId: input.templateId,
                }),
                dueDate: input.dueDate,
                status: { in: ['pending', 'completed'] },
            },
        });
    }
    async findPendingTasksToday(userId, tenantId, today) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId, tenantId });
        return prisma.taskAssignment.findMany({
            where: (0, tenant_scope_1.byTenant)(tenantId, {
                patientId: userId,
                status: 'pending',
                dueDate: today,
            }),
            include: { template: true },
            orderBy: { createdAt: 'asc' },
        });
    }
    async getPlayerStatsRanking(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.playerStats.findMany({
            where: (0, tenant_scope_1.byTenant)(tenantId),
            select: {
                currentLevel: true,
                currentXp: true,
                totalDamageDealt: true,
                patient: { select: { name: true } },
            },
            orderBy: [{ currentLevel: 'desc' }, { currentXp: 'desc' }, { totalDamageDealt: 'desc' }],
        });
    }
    async findPatientsWithActivity(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.patient.findMany({
            where: (0, tenant_scope_1.byTenant)(tenantId),
            include: {
                clinicalRecords: true,
                taskAssignments: {
                    where: { status: 'completed' },
                    include: { template: true },
                },
            },
        });
    }
};
exports.PrismaTasksRepository = PrismaTasksRepository;
exports.PrismaTasksRepository = PrismaTasksRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaTasksRepository);
//# sourceMappingURL=prisma-tasks.repository.js.map