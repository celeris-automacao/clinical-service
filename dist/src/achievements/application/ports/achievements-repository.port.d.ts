import { Reward, RewardClaim } from '@prisma/client';
export interface AchievementsRepositoryPort {
    getOrCreateBadge(tenantId: string, title: string, icon: string): Promise<Reward>;
    findClaim(patientId: string, rewardId: string): Promise<RewardClaim | null>;
    createClaim(patientId: string, tenantId: string, rewardId: string): Promise<RewardClaim>;
}
