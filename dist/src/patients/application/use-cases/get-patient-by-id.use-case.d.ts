import { PatientsRepositoryPort } from '../ports/patients-repository.port';
export declare class GetPatientByIdUseCase {
    private readonly repository;
    constructor(repository: PatientsRepositoryPort);
    execute(id: string, tenantId: string): Promise<any>;
}
