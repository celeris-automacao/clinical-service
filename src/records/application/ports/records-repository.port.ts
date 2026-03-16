import { ClinicalRecord } from '@prisma/client';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';

export interface RecordsRepositoryPort {
  create(data: CreateRecordDto, userId: string, tenantId: string): Promise<ClinicalRecord>;
  findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
  findLastTwo(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
  getClinicalDamageByTenant(tenantId: string): Promise<Map<string, number>>;
}
