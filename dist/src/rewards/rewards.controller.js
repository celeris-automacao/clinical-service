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
const rewards_service_1 = require("./rewards.service");
const supabase_guard_1 = require("../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../common/decorators/get-user.decorator");
let RewardsController = class RewardsController {
    constructor(rewardsService) {
        this.rewardsService = rewardsService;
    }
    getAvailable(user) {
        return this.rewardsService.getAvailableRewards(user);
    }
    claim(rewardId, user) {
        return this.rewardsService.claimReward(rewardId, user);
    }
};
exports.RewardsController = RewardsController;
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
    __metadata("design:paramtypes", [rewards_service_1.RewardsService])
], RewardsController);
//# sourceMappingURL=rewards.controller.js.map