import { PrismaClient } from '@prisma/client';
type RlsCapableClient = {
    $executeRaw: PrismaClient['$executeRaw'];
};
export declare const applyTenantRlsContext: (client: RlsCapableClient, userId: string, tenantId: string) => Promise<void>;
export declare const getSecurePrisma: (client: PrismaClient, userId: string, tenantId: string) => import("@prisma/client/runtime/library").DynamicClientExtensionThis<import(".prisma/client").Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
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
export {};
