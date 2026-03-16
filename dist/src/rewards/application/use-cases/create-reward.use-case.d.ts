import { CreateRewardDto } from '../../presentation/http/dto/create-reward.dto';
import { RewardsRepositoryPort } from '../ports/rewards-repository.port';
export declare class CreateRewardUseCase {
    private readonly repository;
    constructor(repository: RewardsRepositoryPort);
    execute(dto: CreateRewardDto, tenantId: string): Promise<{
        id: string;
        tenantId: string;
        isActive: boolean;
        title: string;
        description: string | null;
        requiredDamage: number;
        goldCost: number;
        badgeIcon: string | null;
    }>;
}
