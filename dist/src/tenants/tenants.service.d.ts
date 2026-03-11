import { ITenantsRepository } from './repositories/interfaces/tenants-repository.interface';
import { CreateTenantDto } from './dto/create-tenant.dto';
export declare class TenantsService {
    private readonly tenantsRepository;
    constructor(tenantsRepository: ITenantsRepository);
    create(createTenantDto: CreateTenantDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
