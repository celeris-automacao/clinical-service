import { Patient } from '@prisma/client';
import { CreatePatientDto } from '../../dto/create-patient.dto';
export interface IPatientsRepository {
    createWithStats(data: CreatePatientDto, tenantId: string): Promise<Patient>;
    findBySupabaseId(id: string): Promise<Patient | null>;
    findById(id: string): Promise<Patient | null>;
}
