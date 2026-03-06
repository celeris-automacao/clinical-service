// src/achievements/repositories/interfaces/achievements.repository.interface.ts
import { Reward, RewardClaim } from '@prisma/client';

export interface IAchievementsRepository {
  /** Busca ou cria a medalha baseada no título e clínica (Evita duplicidade de UUID) */
  getOrCreateBadge(tenantId: string, title: string, icon: string): Promise<Reward>;

  /** Verifica se o paciente já possui esta medalha específica */
  findClaim(patientId: string, rewardId: string): Promise<RewardClaim | null>;

  /** Registra o ganho da medalha para o paciente */
  createClaim(patientId: string, tenantId: string, rewardId: string): Promise<RewardClaim>;
}