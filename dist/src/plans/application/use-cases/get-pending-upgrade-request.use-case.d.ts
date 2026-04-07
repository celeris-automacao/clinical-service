import { PlansRepositoryPort } from '../ports/plans-repository.port';
export declare class GetPendingUpgradeRequestUseCase {
    private readonly plansRepository;
    constructor(plansRepository: PlansRepositoryPort);
    execute(tenantId: string): Promise<any>;
}
