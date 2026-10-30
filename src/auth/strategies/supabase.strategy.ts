import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { decode } from 'jsonwebtoken';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwksRsa = require('jwks-rsa');
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
    const supabaseUrl = authConfigPort.getSupabaseUrl().replace(/\/+$/, '');
    const jwksClient = supabaseUrl
      ? jwksRsa({
          jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
          cache: true,
          rateLimit: true,
        })
      : undefined;
    const jwtSecret = authConfigPort.getSupabaseJwtSecret();

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['ES256', 'HS256'],
      ...(supabaseUrl ? { issuer: `${supabaseUrl}/auth/v1` } : {}),
      secretOrKeyProvider: (_request, rawJwtToken, done) => {
        const token = decode(rawJwtToken, { complete: true });

        if (!token || typeof token === 'string') {
          done(new Error('Invalid Supabase JWT'));
          return;
        }

        if (token.header.alg === 'HS256') {
          if (!jwtSecret) {
            done(new Error('Supabase JWT secret is not configured'));
            return;
          }

          done(null, jwtSecret);
          return;
        }

        if (token.header.alg !== 'ES256' || !token.header.kid || !jwksClient) {
          done(new Error('Unsupported Supabase JWT signing key'));
          return;
        }

        jwksClient.getSigningKey(token.header.kid, (error, signingKey) => {
          if (error || !signingKey) {
            done(error || new Error('Supabase signing key was not found'));
            return;
          }

          done(null, signingKey.getPublicKey());
        });
      },
    });
  }

  async validate(payload: any) {
    return this.mapSupabaseUserUseCase.execute(payload);
  }
}
