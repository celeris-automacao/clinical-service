import { PrismaClient } from '@prisma/client';
import { getSecurePrisma } from '../../prisma/prisma-rls.extension';

describe('getSecurePrisma', () => {
  it('deve injetar app.current_user_id e app.current_tenant_id com bind seguro', async () => {
    const query = jest.fn().mockResolvedValue({ ok: true });
    const mockClient = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $extends: jest.fn().mockImplementation((extension) => extension),
    } as unknown as PrismaClient;

    const userId = 'user-123';
    const tenantId = 'tenant-999';

    const extendedClient = getSecurePrisma(mockClient, userId, tenantId) as any;

    await extendedClient.query.$allModels.$allOperations({
      args: { where: { id: '1' } },
      query,
    });

    expect(mockClient.$executeRaw).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
