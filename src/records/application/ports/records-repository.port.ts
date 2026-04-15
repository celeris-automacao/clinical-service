import { ClinicalRecord } from '@prisma/client';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';
import { UpdateRecordDto } from '../../presentation/http/dto/update-record.dto';

export interface RecordsRepositoryPort {
  create(data: CreateRecordDto, targetPatientId: string, recordedByUserId: string, tenantId: string): Promise<ClinicalRecord>;
  findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
  findLastTwo(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
  getClinicalDamageByTenant(tenantId: string): Promise<Map<string, number>>;
  updateLastRecord(recordId: string, patientId: string, tenantId: string, data: UpdateRecordDto): Promise<ClinicalRecord>;
}
