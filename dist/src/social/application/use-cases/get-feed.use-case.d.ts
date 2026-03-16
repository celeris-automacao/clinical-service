import { SocialRepositoryPort } from '../ports/social-repository.port';
export declare class GetFeedUseCase {
    private readonly repository;
    constructor(repository: SocialRepositoryPort);
    execute(tenantId: string): Promise<any[]>;
}
