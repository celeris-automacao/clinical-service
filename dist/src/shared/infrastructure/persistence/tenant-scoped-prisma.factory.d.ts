import { PrismaService } from '../../../prisma/prisma.service';
export declare class TenantScopedPrismaFactory {
    private readonly prisma;
    constructor(prisma: PrismaService);
    forRoot(): PrismaService;
    forTenantContext(input: {
        userId: string;
        tenantId: string;
    }): import("@prisma/client/runtime/library").DynamicClientExtensionThis<import(".prisma/client").Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
        result: {};
        model: {};
        query: {};
        client: {};
    }, import(".prisma/client").Prisma.PrismaClientOptions>, import(".prisma/client").Prisma.TypeMapCb, {
        result: {};
        model: {};
        query: {};
        client: {};
    }, {}>;
    forTenant(tenantId: string, userId?: string): import("@prisma/client/runtime/library").DynamicClientExtensionThis<import(".prisma/client").Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
        result: {};
        model: {};
        query: {};
        client: {};
    }, import(".prisma/client").Prisma.PrismaClientOptions>, import(".prisma/client").Prisma.TypeMapCb, {
        result: {};
        model: {};
        query: {};
        client: {};
    }, {}>;
    runInTenantTransaction<T>(input: {
        userId: string;
        tenantId: string;
    }, callback: (tx: PrismaService) => Promise<T>): Promise<T>;
}
