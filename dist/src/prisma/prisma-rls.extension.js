"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecurePrisma = void 0;
const getSecurePrisma = (client, userId, tenantId) => {
    return client.$extends({
        query: {
            $allModels: {
                async $allOperations({ args, query }) {
                    await client.$executeRawUnsafe(`SET LOCAL "app.current_user_id" = '${userId}';`);
                    await client.$executeRawUnsafe(`SET LOCAL "app.current_tenant_id" = '${tenantId}';`);
                    return query(args);
                },
            },
        },
    });
};
exports.getSecurePrisma = getSecurePrisma;
//# sourceMappingURL=prisma-rls.extension.js.map