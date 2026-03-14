import { Injectable } from '@nestjs/common';

@Injectable()
export class MapSupabaseUserUseCase {
  execute(payload: any) {
    return {
      userId: payload.sub,
      tenantId: payload.user_metadata?.tenant_id,
      role: payload.user_metadata?.role || 'patient',
      email: payload.email,
    };
  }
}
