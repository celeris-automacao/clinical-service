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
exports.AchievementsRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let AchievementsRepository = class AchievementsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOrCreateBadge(tenantId, title, icon) {
        return this.prisma.reward.upsert({
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
        return this.prisma.rewardClaim.findFirst({
            where: { patientId, rewardId },
        });
    }
    async createClaim(patientId, tenantId, rewardId) {
        return this.prisma.rewardClaim.create({
            data: { rewardId, patientId, tenantId },
        });
    }
};
exports.AchievementsRepository = AchievementsRepository;
exports.AchievementsRepository = AchievementsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AchievementsRepository);
//# sourceMappingURL=achievements.repository.js.map