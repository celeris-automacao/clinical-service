import { Inject, Injectable } from '@nestjs/common';
import { SOCIAL_REPOSITORY } from '../../social.tokens';
import { SocialRepositoryPort } from '../ports/social-repository.port';

@Injectable()
export class CreateSocialPostUseCase {
  constructor(
    @Inject(SOCIAL_REPOSITORY)
    private readonly repository: SocialRepositoryPort,
  ) {}

  async execute(input: {
    patientId: string;
    tenantId: string;
    content: string;
    type: string;
  }) {
    return this.repository.createPost(input);
  }
}
