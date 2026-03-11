import { Patient } from '@prisma/client';
import { CreatePatientDto } from '../../dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../../dto/update-patient-profile.dto';

export interface IPatientsRepository {
  createWithStats(data: CreatePatientDto, tenantId: string): Promise<Patient>;
  findBySupabaseId(id: string): Promise<Patient | null>;
  findById(id: string): Promise<Patient | null>;
  updateProfile(patientId: string, data: UpdatePatientProfileDto): Promise<any>;
}