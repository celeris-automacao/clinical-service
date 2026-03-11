import { ISocialRepository } from './repositories/interfaces/social.repository.interface';
export declare class SocialService {
    private readonly repository;
    constructor(repository: ISocialRepository);
    getFeed(tenantId: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        patientId: string;
        type: string;
        content: string;
    }[]>;
    createPost(patientId: string, tenantId: string, content: string, type: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        patientId: string;
        type: string;
        content: string;
    }>;
}
