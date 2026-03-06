import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id']; // Simulação de extração do JWT [cite: 138]
    const userId = request.headers['x-user-id'];

    if (!tenantId || !userId) {
      throw new UnauthorizedException('Contexto de Tenant ou Usuário ausente.');
    }

    // Injetamos o contexto para ser usado nos Services/Controllers [cite: 91]
    request.user = {
      userId,
      tenantId,
      role: request.headers['x-role'] || 'patient'
    };

    return true;
  }
}