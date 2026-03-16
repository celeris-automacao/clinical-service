import { SocialPost } from '@prisma/client';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { SocialRepositoryPort } from '../../application/ports/social-repository.port';
export declare class PrismaSocialRepository implements SocialRepositoryPort {
    private readonly tenantScopedPrismaFactory;
    constructor(tenantScopedPrismaFactory: TenantScopedPrismaFactory);
    findFeedByTenant(tenantId: string, limit?: number): Promise<SocialPost[]>;
    createPost(data: {
        patientId: string;
        tenantId: string;
        content: string;
        type: string;
    }): Promise<SocialPost>;
}
