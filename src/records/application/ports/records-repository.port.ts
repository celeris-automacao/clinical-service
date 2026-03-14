import { ClinicalRecord } from '@prisma/client';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';

export interface IRecordsRepository {
  create(data: CreateRecordDto, userId: string, tenantId: string): Promise<ClinicalRecord>;
  findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
  findLastTwo(patientId: string): Promise<ClinicalRecord[]>;
  getClinicalDamageByTenant(tenantId: string): Promise<Map<string, number>>;
}
