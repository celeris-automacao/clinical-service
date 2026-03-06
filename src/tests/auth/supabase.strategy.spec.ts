import { SupabaseStrategy } from '../../auth/strategies/supabase.strategy';

describe('SupabaseStrategy', () => {
  let strategy: SupabaseStrategy;

  beforeEach(() => {
    // Precisamos garantir que a variável de ambiente exista para o constructor não falhar
    process.env.SUPABASE_JWT_SECRET = 'test-secret';
    strategy = new SupabaseStrategy();
  });

  describe('validate', () => {
    it('deve extrair e retornar o contexto do usuário corretamente do payload JWT', async () => {
      // Mock do payload que o Supabase envia no JWT
      const payload = {
        sub: 'user-uuid-123',
        email: 'paciente@teste.com',
        user_metadata: {
          tenant_id: 'clinica-xyz',
          role: 'patient'
        }
      };

      const result = await strategy.validate(payload);

      // Valida se o mapeamento das linhas 18-23 está correto
      expect(result).toEqual({
        userId: 'user-uuid-123',
        tenantId: 'clinica-xyz',
        role: 'patient',
        email: 'paciente@teste.com'
      });
    });

    it('deve usar o fallback "patient" se a role não estiver no metadata', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@test.com',
        user_metadata: {} // Metadata vazio
      };

      const result = await strategy.validate(payload);

      // Verifica a linha 21: role || 'patient'
      expect(result.role).toBe('patient');
    });
  });
});