import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
export declare class PatientsController {
    private readonly patientsService;
    constructor(patientsService: PatientsService);
    create(createPatientDto: CreatePatientDto, tenantId: string): Promise<{
        id: string;
        name: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
        tenantId: string;
    }>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
        tenantId: string;
    }>;
    updateProfile(id: string, updateProfileDto: UpdatePatientProfileDto): Promise<any>;
}
