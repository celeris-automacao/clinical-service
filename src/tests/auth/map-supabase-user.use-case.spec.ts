import { UnauthorizedException } from '@nestjs/common';
import { MapSupabaseUserUseCase } from '../../auth/application/use-cases/map-supabase-user.use-case';
import { GetStaffMemberByUserIdUseCase } from '../../staff/application/use-cases/get-staff-member-by-user-id.use-case';

describe('MapSupabaseUserUseCase', () => {
  let useCase: MapSupabaseUserUseCase;
  let getStaffMemberByUserIdUseCase: GetStaffMemberByUserIdUseCase;

  beforeEach(() => {
    getStaffMemberByUserIdUseCase = {
      execute: jest.fn().mockResolvedValue(null),
    } as any;
    useCase = new MapSupabaseUserUseCase(getStaffMemberByUserIdUseCase);
  });

  it('deve extrair e retornar o contexto do usuario corretamente do payload JWT', async () => {
    const payload = {
      sub: 'user-uuid-123',
      email: 'paciente@teste.com',
      user_metadata: {
        tenant_id: 'clinica-xyz',
        role: 'patient',
      },
    };

    const result = await useCase.execute(payload);

    expect(result).toEqual({
      userId: 'user-uuid-123',
      tenantId: 'clinica-xyz',
      role: 'patient',
      staffId: undefined,
      email: 'paciente@teste.com',
    });
  });

  it('deve usar o role do staff ativo quando houver cadastro do profissional', async () => {
    (getStaffMemberByUserIdUseCase.execute as jest.Mock).mockResolvedValue({
      id: 'staff-1',
      role: 'admin',
      status: 'active',
    });

    const result = await useCase.execute({
      sub: 'user-123',
      email: 'staff@test.com',
      user_metadata: {
        tenant_id: 'tenant-1',
      },
    });

    expect(result.role).toBe('admin');
    expect(result.staffId).toBe('staff-1');
  });

  it('deve usar o fallback patient se a role nao estiver no metadata', async () => {
    const payload = {
      sub: 'user-123',
      email: 'test@test.com',
      user_metadata: {
        tenant_id: 'tenant-1',
      },
    };

    const result = await useCase.execute(payload);

    expect(result.role).toBe('patient');
  });

  it('deve rejeitar staff inativo', async () => {
    (getStaffMemberByUserIdUseCase.execute as jest.Mock).mockResolvedValue({
      id: 'staff-1',
      role: 'doctor',
      status: 'inactive',
    });

    await expect(
      useCase.execute({
        sub: 'user-123',
        user_metadata: {
          tenant_id: 'tenant-1',
        },
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('deve rejeitar JWT sem tenant', async () => {
    await expect(
      useCase.execute({
        sub: 'user-123',
        user_metadata: {},
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
