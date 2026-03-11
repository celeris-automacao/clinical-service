import { Gender } from '@prisma/client';
export declare class CreatePatientDto {
    supabaseId: string;
    name: string;
    gender?: Gender;
    birthDate?: string;
}
