import { PrismaService } from '../../prisma/prisma.service';
import { ITenantsRepository } from './interfaces/tenants-repository.interface';
import { CreateTenantDto } from '../dto/create-tenant.dto';
export declare class TenantsRepository implements ITenantsRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(data: CreateTenantDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findById(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(): Promise<({
        _count: {
            patients: number;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
}
