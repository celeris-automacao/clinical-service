import { PlansRepositoryPort } from '../ports/plans-repository.port';
export declare class GetUpgradeRequestsUseCase {
    private readonly plansRepository;
    constructor(plansRepository: PlansRepositoryPort);
    execute(status?: string): Promise<any[]>;
}
