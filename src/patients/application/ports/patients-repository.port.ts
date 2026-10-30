import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../../presentation/http/dto/update-patient-profile.dto';

export interface PatientsRepositoryPort {
  createWithStats(
    data: CreatePatientDto,
    tenantId: string,
    actorUserId?: string,
  ): Promise<any>;
  countByTenant(tenantId: string): Promise<number>;
  findByDocument(document: string, tenantId: string): Promise<any | null>;
  findBySupabaseId(id: string, tenantId: string): Promise<any | null>;
  findById(id: string, tenantId: string): Promise<any | null>;
  findAllByTenant(tenantId: string, search?: string): Promise<any[]>;
  updateProfile(
    patientId: string,
    tenantId: string,
    data: UpdatePatientProfileDto,
  ): Promise<any>;
  findByEmail(
    email: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<any | null>;
  updateEmail(patientId: string, tenantId: string, email: string): Promise<any>;
}
