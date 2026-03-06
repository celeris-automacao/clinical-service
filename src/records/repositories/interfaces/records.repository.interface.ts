// src/records/repositories/interfaces/records.repository.interface.ts
import { ClinicalRecord } from '@prisma/client';
import { CreateRecordDto } from '../../dto/create-record.dto';

export interface IRecordsRepository {
  /** Cria um novo registro clínico */
  create(data: CreateRecordDto, userId: string, tenantId: string): Promise<ClinicalRecord>;

  /** Busca o histórico completo do paciente ordenado por data ASC */
  findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;

  /** Busca os 2 últimos registros para cálculo de dano */
  findLastTwo(patientId: string): Promise<ClinicalRecord[]>;

  getClinicalDamageByTenant(tenantId: string): Promise<Map<string, number>>;
}