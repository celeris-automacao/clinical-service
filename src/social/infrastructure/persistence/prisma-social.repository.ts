import { Injectable } from '@nestjs/common';
import { SocialPost } from '@prisma/client';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { SocialRepositoryPort } from '../../application/ports/social-repository.port';

@Injectable()
export class PrismaSocialRepository implements SocialRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async findFeedByTenant(tenantId: string, limit: number = 20): Promise<SocialPost[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.socialPost.findMany({
      where: { tenantId },
      include: {
        patient: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createPost(data: { patientId: string; tenantId: string; content: string; type: string }): Promise<SocialPost> {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({
      userId: data.patientId,
      tenantId: data.tenantId,
    });
    return prisma.socialPost.create({
      data,
    });
  }
}
