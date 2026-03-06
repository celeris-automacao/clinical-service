// src/social/social.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ISocialRepository } from './repositories/interfaces/social.repository.interface';

@Injectable()
export class SocialService {
  constructor(
    @Inject('ISocialRepository')
    private readonly repository: ISocialRepository
  ) {}

  // Busca o feed da clínica (tenant) do paciente
  async getFeed(tenantId: string) {
    // A lógica de ordenação e inclusão de nomes agora reside no Repository
    return this.repository.findFeedByTenant(tenantId, 20);
  }

  // Cria uma postagem (pode ser disparado por eventos de Game ou Records)
  async createPost(patientId: string, tenantId: string, content: string, type: string) {
    return this.repository.createPost({ patientId, tenantId, content, type });
  }
}