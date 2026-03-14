// src/social/infrastructure/persistence/prisma-social.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SocialPost } from '@prisma/client';
import { SocialRepositoryPort } from '../../application/ports/social-repository.port';

@Injectable()
export class PrismaSocialRepository implements SocialRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findFeedByTenant(tenantId: string, limit: number = 20): Promise<SocialPost[]> {
    return this.prisma.socialPost.findMany({
      where: { tenantId },
      include: { 
        patient: { select: { name: true } } 
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createPost(data: { patientId: string; tenantId: string; content: string; type: string }): Promise<SocialPost> {
    return this.prisma.socialPost.create({
      data,
    });
  }
}
