import { Injectable } from '@nestjs/common';
import { AuthConfigPort } from '../../application/ports/auth-config.port';

@Injectable()
export class EnvAuthConfigAdapter implements AuthConfigPort {
  getSupabaseJwtSecret(): string {
    return process.env.SUPABASE_JWT_SECRET || '';
  }
}
