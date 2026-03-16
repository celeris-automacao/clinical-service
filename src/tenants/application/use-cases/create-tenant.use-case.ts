import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateTenantDto } from '../../presentation/http/dto/create-tenant.dto';
import { TENANTS_REPOSITORY } from '../../tenants.tokens';
import { TenantsRepositoryPort } from '../ports/tenants-repository.port';

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly repository: TenantsRepositoryPort,
  ) {}

  async execute(createTenantDto: CreateTenantDto) {
    const [existingTenant, plan] = await Promise.all([
      this.repository.findByCnpj(createTenantDto.cnpj),
      this.repository.findActivePlanById(createTenantDto.planId),
    ]);

    if (existingTenant) {
      throw new BadRequestException('Ja existe uma clinica cadastrada com este CNPJ.');
    }

    if (!plan) {
      throw new BadRequestException('Plano invalido ou inativo.');
    }

    return this.repository.create(createTenantDto);
  }
}
