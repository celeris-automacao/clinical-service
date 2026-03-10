import { PlayerStats, BossBattle } from '@prisma/client';
export interface IGameRepository {
    findPlayerProgress(patientId: string): Promise<PlayerStats | null>;
    findActiveBoss(tenantId: string): Promise<BossBattle | null>;
}
