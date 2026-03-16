import { PlansRepositoryPort } from '../ports/plans-repository.port';
export declare class GetPlanByIdUseCase {
    private readonly repository;
    constructor(repository: PlansRepositoryPort);
    execute(id: string): Promise<any>;
}
