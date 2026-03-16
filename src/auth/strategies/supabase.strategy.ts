import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { MapSupabaseUserUseCase } from '../application/use-cases/map-supabase-user.use-case';
import { AuthConfigPort } from '../application/ports/auth-config.port';
import { AUTH_CONFIG_PORT } from '../auth.tokens';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(
    @Inject(AUTH_CONFIG_PORT)
    authConfigPort: AuthConfigPort,
    private readonly mapSupabaseUserUseCase: MapSupabaseUserUseCase,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfigPort.getSupabaseJwtSecret(),
    });
  }

  async validate(payload: any) {
    return this.mapSupabaseUserUseCase.execute(payload);
  }
}
