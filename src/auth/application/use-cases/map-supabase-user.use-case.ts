import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class MapSupabaseUserUseCase {
  execute(payload: any) {
    const userId = payload?.sub;
    const tenantId = payload?.user_metadata?.tenant_id;

    if (!userId || !tenantId) {
      throw new UnauthorizedException('JWT sem contexto de tenant ou usuario.');
    }

    return {
      userId,
      tenantId,
      role: payload.user_metadata?.role || 'patient',
      email: payload.email,
    };
  }
}
