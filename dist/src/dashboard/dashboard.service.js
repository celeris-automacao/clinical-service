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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DashboardService = class DashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getClinicOverview(tenantId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeToday = await this.prisma.playerStats.count({
            where: {
                tenantId,
                lastActivityAt: { gte: today }
            }
        });
        const recentAchievements = await this.prisma.socialPost.findMany({
            where: {
                tenantId,
                type: 'achievement'
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                patient: { select: { name: true } }
            }
        });
        const ranking = await this.prisma.playerStats.findMany({
            where: { tenantId },
            orderBy: { totalDamageDealt: 'desc' },
            take: 3,
            include: {
                patient: { select: { name: true } }
            }
        });
        return {
            activeToday,
            recentAchievements: recentAchievements.map(a => ({
                patient: a.patient.name,
                content: a.content,
                date: a.createdAt
            })),
            ranking: ranking.map(p => ({
                name: p.patient.name,
                damage: Number(p.totalDamageDealt),
                level: p.currentLevel
            }))
        };
    }
    async getMissingPatients(tenantId, daysInactive = 3) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysInactive);
        const activity = await this.prisma.taskCompletion.findMany({
            where: {
                tenantId: tenantId,
            },
            select: {
                patientId: true,
                completedAt: true,
            },
            orderBy: {
                completedAt: 'desc',
            },
        });
        const lastActivities = new Map();
        activity.forEach(record => {
            if (!lastActivities.has(record.patientId)) {
                lastActivities.set(record.patientId, record.completedAt);
            }
        });
        const inactivePatients = Array.from(lastActivities.entries())
            .filter(([_, lastDate]) => lastDate < thresholdDate)
            .map(([patientId, lastDate]) => ({
            patientId,
            lastActivity: lastDate,
            status: 'Inativo'
        }));
        return inactivePatients;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map