import { UpdatePatientProfileDto } from '../../presentation/http/dto/update-patient-profile.dto';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';
import { GetPatientByIdUseCase } from './get-patient-by-id.use-case';
export declare class UpdatePatientProfileUseCase {
    private readonly getPatientByIdUseCase;
    private readonly repository;
    constructor(getPatientByIdUseCase: GetPatientByIdUseCase, repository: PatientsRepositoryPort);
    execute(id: string, tenantId: string, updateProfileDto: UpdatePatientProfileDto): Promise<any>;
}
