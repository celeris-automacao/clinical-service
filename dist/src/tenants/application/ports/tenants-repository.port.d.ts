import { CreateTenantDto } from '../../presentation/http/dto/create-tenant.dto';
export interface TenantsRepositoryPort {
    create(data: CreateTenantDto): Promise<any>;
    findById(id: string): Promise<any | null>;
    findAll(): Promise<any[]>;
}
