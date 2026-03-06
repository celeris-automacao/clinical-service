import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard as LegacyAuthGuard } from '../../../common/guards/legacy-auth.guard';

describe('LegacyAuthGuard', () => {
  let guard: LegacyAuthGuard;

  beforeEach(() => {
    guard = new LegacyAuthGuard();
  });

  it('deve permitir acesso se os headers estiverem presentes (Linhas 20-22)', () => {
    const mockRequest = {
      headers: { 'x-tenant-id': 't1', 'x-user-id': 'u1' }
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => mockRequest })
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
    expect(mockRequest['user']).toBeDefined();
  });

  it('deve lançar UnauthorizedException se faltar o tenantId (Linhas 10-12)', () => {
    const mockRequest = { headers: { 'x-user-id': 'u1' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => mockRequest })
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});