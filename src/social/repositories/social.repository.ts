// src/social/repositories/social.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ISocialRepository } from './interfaces/social.repository.interface';
import { SocialPost } from '@prisma/client';

@Injectable()
export class SocialRepository implements ISocialRepository {
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