import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';
export declare class CreatePatientUseCase {
    private readonly repository;
    constructor(repository: PatientsRepositoryPort);
    execute(createPatientDto: CreatePatientDto, tenantId: string): Promise<any>;
}
