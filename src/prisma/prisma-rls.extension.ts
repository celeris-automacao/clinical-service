// src/prisma/prisma-rls.extension.ts
import { PrismaClient } from '@prisma/client';

export const getSecurePrisma = (client: PrismaClient, userId: string, tenantId: string) => {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Injeta as variáveis de sessão para ativar as POLICIES do SQL [cite: 63, 333, 353]
          await client.$executeRawUnsafe(`SET LOCAL "app.current_user_id" = '${userId}';`);
          await client.$executeRawUnsafe(`SET LOCAL "app.current_tenant_id" = '${tenantId}';`);
          return query(args);
        },
      },
    },
  });
};