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
exports.PrismaDashboardRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaDashboardRepository = class PrismaDashboardRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async countActivePlayers(tenantId, since) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.playerStats.count({
            where: {
                tenantId,
                lastActivityAt: { gte: since },
            },
        });
    }
    async findRecentAchievements(tenantId, limit) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.socialPost.findMany({
            where: {
                tenantId,
                type: 'achievement',
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                patient: { select: { name: true } },
            },
        });
    }
    async findTopPlayers(tenantId, limit) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.playerStats.findMany({
            where: { tenantId },
            orderBy: { totalDamageDealt: 'desc' },
            take: limit,
            include: {
                patient: { select: { name: true } },
            },
        });
    }
    async getTaskCompletionsHistory(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.taskCompletion.findMany({
            where: { tenantId },
            select: {
                patientId: true,
                completedAt: true,
            },
            orderBy: {
                completedAt: 'desc',
            },
        });
    }
    async findRecentClaims(tenantId, limit) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.rewardClaim.findMany({
            where: { tenantId },
            include: { reward: true },
            orderBy: { claimedAt: 'desc' },
            take: limit,
        });
    }
};
exports.PrismaDashboardRepository = PrismaDashboardRepository;
exports.PrismaDashboardRepository = PrismaDashboardRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaDashboardRepository);
//# sourceMappingURL=prisma-dashboard.repository.js.map