import { PrismaClient } from '@prisma/client';

type RlsCapableClient = {
  $executeRaw: PrismaClient['$executeRaw'];
};

export const applyTenantRlsContext = async (
  client: RlsCapableClient,
  userId: string,
  tenantId: string,
) => {
  await client.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
  await client.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
};

export const getSecurePrisma = (client: PrismaClient, userId: string, tenantId: string) => {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          await applyTenantRlsContext(client, userId, tenantId);
          return query(args);
        },
      },
    },
  });
};
