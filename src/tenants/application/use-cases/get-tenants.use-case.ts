import { Inject, Injectable } from '@nestjs/common';
import { TENANTS_REPOSITORY } from '../../tenants.tokens';
import { TenantsRepositoryPort } from '../ports/tenants-repository.port';

@Injectable()
export class GetTenantsUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly repository: TenantsRepositoryPort,
  ) {}

  async execute() {
    return this.repository.findAll();
  }
}
