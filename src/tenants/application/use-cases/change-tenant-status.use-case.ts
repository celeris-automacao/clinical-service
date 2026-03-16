import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANTS_REPOSITORY } from '../../tenants.tokens';
import { TenantsRepositoryPort } from '../ports/tenants-repository.port';

@Injectable()
export class ChangeTenantStatusUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly repository: TenantsRepositoryPort,
  ) {}

  async execute(id: string, status: string) {
    const tenant = await this.repository.findById(id);

    if (!tenant) {
      throw new NotFoundException('Clinica nao encontrada.');
    }

    return this.repository.updateStatus(id, status);
  }
}
