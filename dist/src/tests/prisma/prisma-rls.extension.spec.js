"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_rls_extension_1 = require("../../prisma/prisma-rls.extension");
describe('Prisma RLS Extension', () => {
    let mockClient;
    beforeEach(() => {
        mockClient = {
            $extends: jest.fn().mockImplementation((ext) => {
                return {
                    query: ext.query,
                    $executeOperation: async (args) => {
                        return ext.query.$allModels.$allOperations({
                            args,
                            query: (queryArgs) => Promise.resolve([{ id: 1, data: 'secure' }])
                        });
                    }
                };
            }),
            $executeRawUnsafe: jest.fn().mockResolvedValue({}),
        };
    });
    it('deve injetar "app.current_user_id" e "app.current_tenant_id" no banco (Linhas 10-11)', async () => {
        const userId = 'user-001';
        const tenantId = 'tenant-999';
        const extendedClient = (0, prisma_rls_extension_1.getSecurePrisma)(mockClient, userId, tenantId);
        const result = await extendedClient.$executeOperation({});
        expect(mockClient.$executeRawUnsafe).toHaveBeenCalledWith(`SET LOCAL "app.current_user_id" = '${userId}';`);
        expect(mockClient.$executeRawUnsafe).toHaveBeenCalledWith(`SET LOCAL "app.current_tenant_id" = '${tenantId}';`);
        expect(result).toEqual([{ id: 1, data: 'secure' }]);
    });
});
//# sourceMappingURL=prisma-rls.extension.spec.js.map