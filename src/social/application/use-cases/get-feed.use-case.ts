import { Inject, Injectable } from '@nestjs/common';
import { SOCIAL_REPOSITORY } from '../../social.tokens';
import { SocialRepositoryPort } from '../ports/social-repository.port';

@Injectable()
export class GetFeedUseCase {
  constructor(
    @Inject(SOCIAL_REPOSITORY)
    private readonly repository: SocialRepositoryPort,
  ) {}

  async execute(tenantId: string) {
    return this.repository.findFeedByTenant(tenantId, 20);
  }
}
