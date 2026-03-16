import { PlansRepositoryPort } from '../ports/plans-repository.port';
export declare class GetPlansUseCase {
    private readonly repository;
    constructor(repository: PlansRepositoryPort);
    execute(): Promise<any[]>;
}
