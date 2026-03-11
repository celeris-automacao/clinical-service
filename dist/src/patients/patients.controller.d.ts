import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
export declare class PatientsController {
    private readonly patientsService;
    constructor(patientsService: PatientsService);
    create(createPatientDto: CreatePatientDto, tenantId: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        tenantId: string;
        gender: import(".prisma/client").$Enums.Gender | null;
        birthDate: Date | null;
    }>;
}
