export interface GameRepositoryPort {
  findPlayerProgress(patientId: string): Promise<any | null>;
  findActiveBoss(tenantId: string): Promise<any | null>;
}
