import { SocialRepositoryPort } from '../ports/social-repository.port';
export declare class CreateSocialPostUseCase {
    private readonly repository;
    constructor(repository: SocialRepositoryPort);
    execute(input: {
        patientId: string;
        tenantId: string;
        content: string;
        type: string;
    }): Promise<any>;
}
