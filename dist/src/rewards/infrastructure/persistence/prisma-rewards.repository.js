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
exports.PrismaRewardsRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
const tenant_scope_1 = require("../../../shared/infrastructure/persistence/tenant-scope");
let PrismaRewardsRepository = class PrismaRewardsRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async create(data) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(data.tenantId);
        return prisma.reward.create({ data });
    }
    async findAllActiveByTenant(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.reward.findMany({
            where: (0, tenant_scope_1.byTenant)(tenantId, { isActive: true }),
        });
    }
    async findByTitle(title, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.reward.findFirst({
            where: (0, tenant_scope_1.byTenant)(tenantId, { title }),
        });
    }
    async findClaimsByPatient(patientId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
        return prisma.rewardClaim.findMany({
            where: (0, tenant_scope_1.byPatientAndTenant)(patientId, tenantId),
        });
    }
    async findById(rewardId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.reward.findFirst({
            where: (0, tenant_scope_1.byIdAndTenant)(rewardId, tenantId),
        });
    }
    async findSpecificClaim(rewardId, patientId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
        return prisma.rewardClaim.findFirst({
            where: { rewardId, ...(0, tenant_scope_1.byPatientAndTenant)(patientId, tenantId) },
        });
    }
    async createClaim(data) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({
            userId: data.patientId,
            tenantId: data.tenantId,
        });
        return prisma.rewardClaim.create({ data });
    }
};
exports.PrismaRewardsRepository = PrismaRewardsRepository;
exports.PrismaRewardsRepository = PrismaRewardsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaRewardsRepository);
//# sourceMappingURL=prisma-rewards.repository.js.map