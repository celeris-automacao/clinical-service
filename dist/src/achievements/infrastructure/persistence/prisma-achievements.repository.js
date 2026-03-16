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
exports.PrismaAchievementsRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaAchievementsRepository = class PrismaAchievementsRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async getOrCreateBadge(tenantId, title, icon) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.reward.upsert({
            where: { title_tenantId: { title, tenantId } },
            update: {},
            create: {
                tenantId,
                title,
                requiredDamage: 0,
                badgeIcon: icon,
                isActive: true,
            },
        });
    }
    async findClaim(patientId, rewardId) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.rewardClaim.findFirst({
            where: { patientId, rewardId },
        });
    }
    async createClaim(patientId, tenantId, rewardId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
        return prisma.rewardClaim.create({
            data: { rewardId, patientId, tenantId },
        });
    }
};
exports.PrismaAchievementsRepository = PrismaAchievementsRepository;
exports.PrismaAchievementsRepository = PrismaAchievementsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaAchievementsRepository);
//# sourceMappingURL=prisma-achievements.repository.js.map