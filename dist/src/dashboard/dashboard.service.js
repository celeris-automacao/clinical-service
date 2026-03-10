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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
let DashboardService = class DashboardService {
    constructor(repository) {
        this.repository = repository;
    }
    async getClinicOverview(tenantId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [activeCount, achievements, ranking] = await Promise.all([
            this.repository.countActivePlayers(tenantId, today),
            this.repository.findRecentAchievements(tenantId, 5),
            this.repository.findTopPlayers(tenantId, 3)
        ]);
        return {
            activeToday: activeCount,
            recentAchievements: achievements.map(a => ({
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
        const activity = await this.repository.getTaskCompletionsHistory(tenantId);
        const lastActivities = new Map();
        activity.forEach(record => {
            if (!lastActivities.has(record.patientId)) {
                lastActivities.set(record.patientId, record.completedAt);
            }
        });
        return Array.from(lastActivities.entries())
            .filter(([_, lastDate]) => lastDate < thresholdDate)
            .map(([patientId, lastDate]) => ({
            patientId,
            lastActivity: lastDate,
            status: 'Inativo'
        }));
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('IDashboardRepository')),
    __metadata("design:paramtypes", [Object])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map