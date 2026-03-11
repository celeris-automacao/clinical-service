import { Tenant } from '@prisma/client';
import { CreateTenantDto } from '../../dto/create-tenant.dto';

export interface ITenantsRepository {
  create(data: CreateTenantDto): Promise<Tenant>;
  findById(id: string): Promise<Tenant | null>;
  findAll(): Promise<Tenant[]>;
}