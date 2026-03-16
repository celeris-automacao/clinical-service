import { TenantPlanPort } from '../../../shared/application/ports/tenant-plan.port';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';
export declare class CreatePatientUseCase {
    private readonly repository;
    private readonly tenantPlanPort;
    constructor(repository: PatientsRepositoryPort, tenantPlanPort: TenantPlanPort);
    execute(createPatientDto: CreatePatientDto, tenantId: string): Promise<any>;
}
