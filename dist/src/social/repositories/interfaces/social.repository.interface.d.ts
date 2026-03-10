import { SocialPost } from '@prisma/client';
export interface ISocialRepository {
    findFeedByTenant(tenantId: string, limit: number): Promise<SocialPost[]>;
    createPost(data: {
        patientId: string;
        tenantId: string;
        content: string;
        type: string;
    }): Promise<SocialPost>;
}
