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
exports.ClaimRewardUseCase = void 0;
const common_1 = require("@nestjs/common");
const rewards_tokens_1 = require("../../rewards.tokens");
let ClaimRewardUseCase = class ClaimRewardUseCase {
    constructor(repository, rewardClaimTransactionPort, rewardsEventsPort) {
        this.repository = repository;
        this.rewardClaimTransactionPort = rewardClaimTransactionPort;
        this.rewardsEventsPort = rewardsEventsPort;
    }
    async execute(rewardId, user) {
        const reward = await this.repository.findById(rewardId, user.tenantId);
        if (!reward) {
            throw new common_1.BadRequestException('Recompensa não encontrada.');
        }
        const alreadyClaimed = await this.repository.findSpecificClaim(rewardId, user.userId, user.tenantId);
        if (alreadyClaimed) {
            throw new common_1.BadRequestException('Você já resgatou esta recompensa!');
        }
        const result = await this.rewardClaimTransactionPort.claimReward({
            rewardId,
            patientId: user.userId,
            tenantId: user.tenantId,
            requiredDamage: reward.requiredDamage,
            goldCost: reward.goldCost,
        });
        await this.rewardsEventsPort.emitRewardClaimed({
            userId: user.userId,
            tenantId: user.tenantId,
            achievement: reward.title,
        });
        return {
            success: true,
            remainingGold: result.remainingGold,
        };
    }
};
exports.ClaimRewardUseCase = ClaimRewardUseCase;
exports.ClaimRewardUseCase = ClaimRewardUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(rewards_tokens_1.REWARDS_REPOSITORY)),
    __param(1, (0, common_1.Inject)(rewards_tokens_1.REWARD_CLAIM_TRANSACTION_PORT)),
    __param(2, (0, common_1.Inject)(rewards_tokens_1.REWARDS_EVENTS_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object])
], ClaimRewardUseCase);
//# sourceMappingURL=claim-reward.use-case.js.map