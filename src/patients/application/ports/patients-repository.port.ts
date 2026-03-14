import { CreatePatientDto } from '../../dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../../dto/update-patient-profile.dto';

export interface PatientsRepositoryPort {
  createWithStats(data: CreatePatientDto, tenantId: string): Promise<any>;
  findBySupabaseId(id: string): Promise<any | null>;
  findById(id: string): Promise<any | null>;
  updateProfile(patientId: string, data: UpdatePatientProfileDto): Promise<any>;
}
