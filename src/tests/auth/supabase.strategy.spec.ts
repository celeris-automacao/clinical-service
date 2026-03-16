import { Test, TestingModule } from '@nestjs/testing';
import { AuthConfigPort } from '../../auth/application/ports/auth-config.port';
import { MapSupabaseUserUseCase } from '../../auth/application/use-cases/map-supabase-user.use-case';
import { AUTH_CONFIG_PORT } from '../../auth/auth.tokens';
import { SupabaseStrategy } from '../../auth/strategies/supabase.strategy';

describe('SupabaseStrategy', () => {
  let strategy: SupabaseStrategy;
  let mapSupabaseUserUseCase: MapSupabaseUserUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseStrategy,
        {
          provide: MapSupabaseUserUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: AUTH_CONFIG_PORT,
          useValue: {
            getSupabaseJwtSecret: jest.fn().mockReturnValue('test-secret'),
          } satisfies AuthConfigPort,
        },
      ],
    }).compile();

    strategy = module.get<SupabaseStrategy>(SupabaseStrategy);
    mapSupabaseUserUseCase = module.get<MapSupabaseUserUseCase>(MapSupabaseUserUseCase);
  });

  it('deve delegar o payload JWT para o use case de mapeamento', async () => {
    const payload = {
      sub: 'user-uuid-123',
      email: 'paciente@teste.com',
      user_metadata: {
        tenant_id: 'clinica-xyz',
        role: 'patient',
      },
    };

    (mapSupabaseUserUseCase.execute as jest.Mock).mockResolvedValue({
      userId: 'user-uuid-123',
      tenantId: 'clinica-xyz',
      role: 'patient',
      email: 'paciente@teste.com',
    });

    const result = await strategy.validate(payload);

    expect(mapSupabaseUserUseCase.execute).toHaveBeenCalledWith(payload);
    expect(result).toEqual({
      userId: 'user-uuid-123',
      tenantId: 'clinica-xyz',
      role: 'patient',
      email: 'paciente@teste.com',
    });
  });
});
