export interface RewardsEventsPort {
  emitRewardClaimed(input: {
    userId: string;
    tenantId: string;
    achievement: string;
  }): Promise<void>;
}
