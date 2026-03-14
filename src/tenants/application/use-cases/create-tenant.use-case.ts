import { Inject, Injectable } from '@nestjs/common';
import { CreateTenantDto } from '../../dto/create-tenant.dto';
import { TENANTS_REPOSITORY } from '../../tenants.tokens';
import { TenantsRepositoryPort } from '../ports/tenants-repository.port';

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly repository: TenantsRepositoryPort,
  ) {}

  async execute(createTenantDto: CreateTenantDto) {
    return this.repository.create(createTenantDto);
  }
}
