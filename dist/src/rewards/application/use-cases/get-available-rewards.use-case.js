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
exports.GetAvailableRewardsUseCase = void 0;
const common_1 = require("@nestjs/common");
const rewards_tokens_1 = require("../../rewards.tokens");
let GetAvailableRewardsUseCase = class GetAvailableRewardsUseCase {
    constructor(repository, rewardsStatsPort) {
        this.repository = repository;
        this.rewardsStatsPort = rewardsStatsPort;
    }
    async execute(user) {
        const stats = await this.rewardsStatsPort.getStats(user);
        const [rewards, claims] = await Promise.all([
            this.repository.findAllActiveByTenant(user.tenantId),
            this.repository.findClaimsByPatient(user.userId, user.tenantId),
        ]);
        return rewards.map((reward) => ({
            ...reward,
            unlocked: stats.totalDamage >= reward.requiredDamage,
            claimed: claims.some((claim) => claim.rewardId === reward.id),
            progress: Math.min(100, (stats.totalDamage / reward.requiredDamage) * 100),
        }));
    }
};
exports.GetAvailableRewardsUseCase = GetAvailableRewardsUseCase;
exports.GetAvailableRewardsUseCase = GetAvailableRewardsUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(rewards_tokens_1.REWARDS_REPOSITORY)),
    __param(1, (0, common_1.Inject)(rewards_tokens_1.REWARDS_STATS_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], GetAvailableRewardsUseCase);
//# sourceMappingURL=get-available-rewards.use-case.js.map