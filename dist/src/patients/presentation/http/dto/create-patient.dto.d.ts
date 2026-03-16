import { Gender } from '@prisma/client';
import { PatientAddressDto } from './patient-address.dto';
export declare class CreatePatientDto {
    supabaseId: string;
    name: string;
    email?: string;
    phone?: string;
    document?: string;
    gender?: Gender;
    birthDate?: string;
    address?: PatientAddressDto;
}
