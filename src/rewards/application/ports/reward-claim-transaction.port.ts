export interface RewardClaimTransactionPort {
  claimReward(input: {
    rewardId: string;
    patientId: string;
    tenantId: string;
    requiredDamage: number;
    goldCost: number;
  }): Promise<{
    remainingGold: number;
  }>;
}
