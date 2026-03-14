import { Module } from '@nestjs/common';
import { RecordsModule } from '../records/records.module';
import { ClaimRewardUseCase } from './application/use-cases/claim-reward.use-case';
import { GetAvailableRewardsUseCase } from './application/use-cases/get-available-rewards.use-case';
import { RecordsRewardsStatsAdapter } from './infrastructure/adapters/records-rewards-stats.adapter';
import { RewardsEventsAdapter } from './infrastructure/adapters/rewards-events.adapter';
import { PrismaRewardClaimTransactionAdapter } from './infrastructure/persistence/prisma-reward-claim-transaction.adapter';
import { RewardsController } from './presentation/http/rewards.controller';
import { PrismaRewardsRepository } from './infrastructure/persistence/prisma-rewards.repository';
import {
  REWARD_CLAIM_TRANSACTION_PORT,
  REWARDS_EVENTS_PORT,
  REWARDS_REPOSITORY,
  REWARDS_STATS_PORT,
} from './rewards.tokens';

@Module({
  imports: [RecordsModule],
  providers: [
    GetAvailableRewardsUseCase,
    ClaimRewardUseCase,
    {
      provide: REWARDS_REPOSITORY,
      useClass: PrismaRewardsRepository,
    },
    {
      provide: REWARDS_STATS_PORT,
      useClass: RecordsRewardsStatsAdapter,
    },
    {
      provide: REWARD_CLAIM_TRANSACTION_PORT,
      useClass: PrismaRewardClaimTransactionAdapter,
    },
    {
      provide: REWARDS_EVENTS_PORT,
      useClass: RewardsEventsAdapter,
    },
  ],
  controllers: [RewardsController],
})
export class RewardsModule {}
