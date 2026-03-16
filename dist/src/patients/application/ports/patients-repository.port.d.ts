import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../../presentation/http/dto/update-patient-profile.dto';
export interface PatientsRepositoryPort {
    createWithStats(data: CreatePatientDto, tenantId: string): Promise<any>;
    findBySupabaseId(id: string, tenantId: string): Promise<any | null>;
    findById(id: string, tenantId: string): Promise<any | null>;
    updateProfile(patientId: string, tenantId: string, data: UpdatePatientProfileDto): Promise<any>;
}
