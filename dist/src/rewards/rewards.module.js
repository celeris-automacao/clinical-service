"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardsModule = void 0;
const common_1 = require("@nestjs/common");
const records_module_1 = require("../records/records.module");
const claim_reward_use_case_1 = require("./application/use-cases/claim-reward.use-case");
const create_reward_use_case_1 = require("./application/use-cases/create-reward.use-case");
const get_available_rewards_use_case_1 = require("./application/use-cases/get-available-rewards.use-case");
const records_rewards_stats_adapter_1 = require("./infrastructure/adapters/records-rewards-stats.adapter");
const rewards_events_adapter_1 = require("./infrastructure/adapters/rewards-events.adapter");
const prisma_reward_claim_transaction_adapter_1 = require("./infrastructure/persistence/prisma-reward-claim-transaction.adapter");
const rewards_controller_1 = require("./presentation/http/rewards.controller");
const prisma_rewards_repository_1 = require("./infrastructure/persistence/prisma-rewards.repository");
const rewards_tokens_1 = require("./rewards.tokens");
let RewardsModule = class RewardsModule {
};
exports.RewardsModule = RewardsModule;
exports.RewardsModule = RewardsModule = __decorate([
    (0, common_1.Module)({
        imports: [records_module_1.RecordsModule],
        providers: [
            create_reward_use_case_1.CreateRewardUseCase,
            get_available_rewards_use_case_1.GetAvailableRewardsUseCase,
            claim_reward_use_case_1.ClaimRewardUseCase,
            {
                provide: rewards_tokens_1.REWARDS_REPOSITORY,
                useClass: prisma_rewards_repository_1.PrismaRewardsRepository,
            },
            {
                provide: rewards_tokens_1.REWARDS_STATS_PORT,
                useClass: records_rewards_stats_adapter_1.RecordsRewardsStatsAdapter,
            },
            {
                provide: rewards_tokens_1.REWARD_CLAIM_TRANSACTION_PORT,
                useClass: prisma_reward_claim_transaction_adapter_1.PrismaRewardClaimTransactionAdapter,
            },
            {
                provide: rewards_tokens_1.REWARDS_EVENTS_PORT,
                useClass: rewards_events_adapter_1.RewardsEventsAdapter,
            },
        ],
        controllers: [rewards_controller_1.RewardsController],
    })
], RewardsModule);
//# sourceMappingURL=rewards.module.js.map