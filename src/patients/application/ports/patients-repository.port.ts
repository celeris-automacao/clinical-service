import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../../presentation/http/dto/update-patient-profile.dto';

export interface PatientsRepositoryPort {
  createWithStats(data: CreatePatientDto, tenantId: string): Promise<any>;
  countByTenant(tenantId: string): Promise<number>;
  findBySupabaseId(id: string, tenantId: string): Promise<any | null>;
  findById(id: string, tenantId: string): Promise<any | null>;
  findAll(tenantId: string, filters: { responsibleStaffId?: string }): Promise<any[]>;
  update(id: string, tenantId: string, data: Partial<CreatePatientDto>): Promise<any>;
  updateProfile(patientId: string, tenantId: string, data: UpdatePatientProfileDto): Promise<any>;
}
