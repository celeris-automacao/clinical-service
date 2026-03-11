import { IPatientsRepository } from './repositories/interfaces/patients-repository.interface';
import { CreatePatientDto } from './dto/create-patient.dto';
export declare class PatientsService {
    private readonly patientsRepository;
    constructor(patientsRepository: IPatientsRepository);
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
