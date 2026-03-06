// src/game/repositories/interfaces/game.repository.interface.ts
import { PlayerStats, BossBattle } from '@prisma/client';

export interface IGameRepository {
  /** Busca o progresso de nível e XP do jogador */
  findPlayerProgress(patientId: string): Promise<PlayerStats | null>;

  /** Busca o Boss ativo da clínica (SaaS) */
  findActiveBoss(tenantId: string): Promise<BossBattle | null>;
}