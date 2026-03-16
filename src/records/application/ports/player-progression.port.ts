export interface PlayerProgressionPort {
  upsertClinicalProgress(input: {
    patientId: string;
    tenantId: string;
    damageDealt: number;
  }): Promise<void>;
}
