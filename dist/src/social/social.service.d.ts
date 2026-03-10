import { ISocialRepository } from './repositories/interfaces/social.repository.interface';
export declare class SocialService {
    private readonly repository;
    constructor(repository: ISocialRepository);
    getFeed(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        type: string;
        patientId: string;
        content: string;
        createdAt: Date;
    }[]>;
    createPost(patientId: string, tenantId: string, content: string, type: string): Promise<{
        id: string;
        tenantId: string;
        type: string;
        patientId: string;
        content: string;
        createdAt: Date;
    }>;
}
