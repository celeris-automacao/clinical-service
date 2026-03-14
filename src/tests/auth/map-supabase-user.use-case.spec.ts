import { MapSupabaseUserUseCase } from '../../auth/application/use-cases/map-supabase-user.use-case';

describe('MapSupabaseUserUseCase', () => {
  let useCase: MapSupabaseUserUseCase;

  beforeEach(() => {
    useCase = new MapSupabaseUserUseCase();
  });

  it('deve extrair e retornar o contexto do usuário corretamente do payload JWT', () => {
    const payload = {
      sub: 'user-uuid-123',
      email: 'paciente@teste.com',
      user_metadata: {
        tenant_id: 'clinica-xyz',
        role: 'patient',
      },
    };

    const result = useCase.execute(payload);

    expect(result).toEqual({
      userId: 'user-uuid-123',
      tenantId: 'clinica-xyz',
      role: 'patient',
      email: 'paciente@teste.com',
    });
  });

  it('deve usar o fallback patient se a role não estiver no metadata', () => {
    const payload = {
      sub: 'user-123',
      email: 'test@test.com',
      user_metadata: {},
    };

    const result = useCase.execute(payload);

    expect(result.role).toBe('patient');
  });
});
