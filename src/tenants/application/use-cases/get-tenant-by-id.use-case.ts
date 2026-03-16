import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANTS_REPOSITORY } from '../../tenants.tokens';
import { TenantsRepositoryPort } from '../ports/tenants-repository.port';

@Injectable()
export class GetTenantByIdUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly repository: TenantsRepositoryPort,
  ) {}

  async execute(id: string) {
    const tenant = await this.repository.findById(id);

    if (!tenant) {
      throw new NotFoundException(`Clínica com ID ${id} não encontrada.`);
    }

    return tenant;
  }
}
