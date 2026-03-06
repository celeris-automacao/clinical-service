import { PrismaClient } from '@prisma/client';
import { getSecurePrisma } from '../../prisma/prisma-rls.extension';

describe('Prisma RLS Extension', () => {
  let mockClient: any;

  beforeEach(() => {
    // Mockamos o cliente Prisma de forma que ele capture a lógica da extensão
    mockClient = {
      $extends: jest.fn().mockImplementation((ext) => {
        // Simulamos o comportamento do interceptor para fins de teste
        return {
          query: ext.query,
          // Criamos um método simulado (ex: findMany) que dispara o interceptor
          $executeOperation: async (args: any) => {
            return ext.query.$allModels.$allOperations({
              args,
              query: (queryArgs: any) => Promise.resolve([{ id: 1, data: 'secure' }])
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

    // Inicializa a extensão
    const extendedClient = getSecurePrisma(mockClient, userId, tenantId);

    // Disparamos uma operação simulada que aciona o interceptor
    const result = await (extendedClient as any).$executeOperation({});

    // VERIFICAÇÃO CRÍTICA: As linhas 10 e 11 da imagem_9038e0.png foram chamadas?
    expect(mockClient.$executeRawUnsafe).toHaveBeenCalledWith(
      `SET LOCAL "app.current_user_id" = '${userId}';`
    );
    expect(mockClient.$executeRawUnsafe).toHaveBeenCalledWith(
      `SET LOCAL "app.current_tenant_id" = '${tenantId}';`
    );

    // Garante que a query original (linha 12) retornou o resultado esperado
    expect(result).toEqual([{ id: 1, data: 'secure' }]);
  });
});