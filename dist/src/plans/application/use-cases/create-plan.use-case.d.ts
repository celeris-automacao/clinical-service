import { CreatePlanDto } from '../../presentation/http/dto/create-plan.dto';
import { PlansRepositoryPort } from '../ports/plans-repository.port';
export declare class CreatePlanUseCase {
    private readonly repository;
    constructor(repository: PlansRepositoryPort);
    execute(dto: CreatePlanDto): Promise<any>;
}
