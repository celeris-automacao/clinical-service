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
exports.PrismaStaffAuditLogAdapter = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaStaffAuditLogAdapter = class PrismaStaffAuditLogAdapter {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async create(input) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({
            userId: input.actorUserId,
            tenantId: input.tenantId,
        });
        await prisma.staffAuditLog.create({
            data: {
                tenantId: input.tenantId,
                actorUserId: input.actorUserId,
                targetStaffId: input.targetStaffId,
                action: input.action,
                metadata: input.metadata ? JSON.stringify(input.metadata) : null,
            },
        });
    }
};
exports.PrismaStaffAuditLogAdapter = PrismaStaffAuditLogAdapter;
exports.PrismaStaffAuditLogAdapter = PrismaStaffAuditLogAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaStaffAuditLogAdapter);
//# sourceMappingURL=prisma-staff-audit-log.adapter.js.map