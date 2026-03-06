// src/rewards/repositories/interfaces/rewards.repository.interface.ts
import { Reward, RewardClaim } from '@prisma/client';

export interface IRewardsRepository {
  /** Busca todas as recompensas ativas de uma clínica específica */
  findAllActiveByTenant(tenantId: string): Promise<Reward[]>;

  /** Busca o histórico de resgates de um paciente */
  findClaimsByPatient(patientId: string): Promise<RewardClaim[]>;

  /** Busca uma recompensa específica pelo ID */
  findById(rewardId: string): Promise<Reward | null>;

  /** Verifica se um resgate específico já existe */
  findSpecificClaim(rewardId: string, patientId: string): Promise<RewardClaim | null>;

  /** Registra um novo resgate de recompensa */
  createClaim(data: {
    rewardId: string;
    patientId: string;
    tenantId: string;
  }): Promise<RewardClaim>;
}