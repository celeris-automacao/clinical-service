// src/social/repositories/interfaces/social.repository.interface.ts
import { SocialPost } from '@prisma/client';

export interface ISocialRepository {
  /** Busca o feed de postagens de um tenant específico */
  findFeedByTenant(tenantId: string, limit: number): Promise<SocialPost[]>;

  /** Persiste uma nova postagem no feed social */
  createPost(data: { 
    patientId: string; 
    tenantId: string; 
    content: string; 
    type: string 
  }): Promise<SocialPost>;
}