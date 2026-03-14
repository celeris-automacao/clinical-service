import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { MapSupabaseUserUseCase } from './application/use-cases/map-supabase-user.use-case';
import { AUTH_CONFIG_PORT } from './auth.tokens';
import { EnvAuthConfigAdapter } from './infrastructure/adapters/env-auth-config.adapter';
import { SupabaseStrategy } from './strategies/supabase.strategy';

@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'supabase' })],
  providers: [
    MapSupabaseUserUseCase,
    {
      provide: AUTH_CONFIG_PORT,
      useClass: EnvAuthConfigAdapter,
    },
    SupabaseStrategy,
  ],
  exports: [PassportModule, MapSupabaseUserUseCase, AUTH_CONFIG_PORT, SupabaseStrategy],
})
export class AuthModule {}
