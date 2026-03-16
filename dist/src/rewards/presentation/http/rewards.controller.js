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
exports.RewardsController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const claim_reward_use_case_1 = require("../../application/use-cases/claim-reward.use-case");
const create_reward_use_case_1 = require("../../application/use-cases/create-reward.use-case");
const get_available_rewards_use_case_1 = require("../../application/use-cases/get-available-rewards.use-case");
const create_reward_dto_1 = require("./dto/create-reward.dto");
let RewardsController = class RewardsController {
    constructor(createRewardUseCase, getAvailableRewardsUseCase, claimRewardUseCase) {
        this.createRewardUseCase = createRewardUseCase;
        this.getAvailableRewardsUseCase = getAvailableRewardsUseCase;
        this.claimRewardUseCase = claimRewardUseCase;
    }
    create(dto, user) {
        return this.createRewardUseCase.execute(dto, user.tenantId);
    }
    getAvailable(user) {
        return this.getAvailableRewardsUseCase.execute(user);
    }
    claim(rewardId, user) {
        return this.claimRewardUseCase.execute(rewardId, user);
    }
};
exports.RewardsController = RewardsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('owner', 'admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_reward_dto_1.CreateRewardDto, Object]),
    __metadata("design:returntype", void 0)
], RewardsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RewardsController.prototype, "getAvailable", null);
__decorate([
    (0, common_1.Post)(':id/claim'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RewardsController.prototype, "claim", null);
exports.RewardsController = RewardsController = __decorate([
    (0, common_1.Controller)('rewards'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    __metadata("design:paramtypes", [create_reward_use_case_1.CreateRewardUseCase,
        get_available_rewards_use_case_1.GetAvailableRewardsUseCase,
        claim_reward_use_case_1.ClaimRewardUseCase])
], RewardsController);
//# sourceMappingURL=rewards.controller.js.map