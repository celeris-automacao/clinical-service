"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecurePrisma = exports.applyTenantRlsContext = void 0;
const applyTenantRlsContext = async (client, userId, tenantId) => {
    await client.$executeRaw `SELECT set_config('app.current_user_id', ${userId}, true)`;
    await client.$executeRaw `SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
};
exports.applyTenantRlsContext = applyTenantRlsContext;
const getSecurePrisma = (client, userId, tenantId) => {
    return client.$extends({
        query: {
            $allModels: {
                async $allOperations({ args, query }) {
                    await (0, exports.applyTenantRlsContext)(client, userId, tenantId);
                    return query(args);
                },
            },
        },
    });
};
exports.getSecurePrisma = getSecurePrisma;
//# sourceMappingURL=prisma-rls.extension.js.map