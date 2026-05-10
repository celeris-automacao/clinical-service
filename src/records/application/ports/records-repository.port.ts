import { ClinicalNote, ClinicalRecord } from '@prisma/client';
import { CreateClinicalNoteDto } from '../../presentation/http/dto/create-clinical-note.dto';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';
import { UpdateClinicalNoteDto } from '../../presentation/http/dto/update-clinical-note.dto';
import { UpdateRecordDto } from '../../presentation/http/dto/update-record.dto';

export interface RecordsRepositoryPort {
  create(data: CreateRecordDto, targetPatientId: string, recordedByUserId: string, tenantId: string): Promise<ClinicalRecord>;
  findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
  findLastTwo(patientId: string, tenantId: string): Promise<ClinicalRecord[]>;
  getClinicalDamageByTenant(tenantId: string): Promise<Map<string, number>>;
  updateLastRecord(recordId: string, patientId: string, tenantId: string, data: UpdateRecordDto): Promise<ClinicalRecord>;
  createClinicalNote(data: CreateClinicalNoteDto, authorUserId: string, tenantId: string): Promise<ClinicalNote>;
  listClinicalNotesByPatient(patientId: string, tenantId: string): Promise<ClinicalNote[]>;
  updateClinicalNote(noteId: string, tenantId: string, data: UpdateClinicalNoteDto): Promise<ClinicalNote>;
}
