import { PrismaService } from '../../prisma/prisma.service';
import { ISocialRepository } from './interfaces/social.repository.interface';
import { SocialPost } from '@prisma/client';
export declare class SocialRepository implements ISocialRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findFeedByTenant(tenantId: string, limit?: number): Promise<SocialPost[]>;
    createPost(data: {
        patientId: string;
        tenantId: string;
        content: string;
        type: string;
    }): Promise<SocialPost>;
}
