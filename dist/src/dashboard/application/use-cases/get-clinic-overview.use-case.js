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
exports.GetClinicOverviewUseCase = void 0;
const common_1 = require("@nestjs/common");
const dashboard_tokens_1 = require("../../dashboard.tokens");
let GetClinicOverviewUseCase = class GetClinicOverviewUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(tenantId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [activeCount, achievements, ranking] = await Promise.all([
            this.repository.countActivePlayers(tenantId, today),
            this.repository.findRecentAchievements(tenantId, 5),
            this.repository.findTopPlayers(tenantId, 3),
        ]);
        return {
            activeToday: activeCount,
            recentAchievements: achievements.map((achievement) => ({
                patient: achievement.patient.name,
                content: achievement.content,
                date: achievement.createdAt,
            })),
            ranking: ranking.map((player) => ({
                name: player.patient.name,
                damage: Number(player.totalDamageDealt),
                level: player.currentLevel,
            })),
        };
    }
};
exports.GetClinicOverviewUseCase = GetClinicOverviewUseCase;
exports.GetClinicOverviewUseCase = GetClinicOverviewUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(dashboard_tokens_1.DASHBOARD_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], GetClinicOverviewUseCase);
//# sourceMappingURL=get-clinic-overview.use-case.js.map