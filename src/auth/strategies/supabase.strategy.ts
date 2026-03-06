// src/auth/strategies/supabase.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.SUPABASE_JWT_SECRET, // Sua CURRENT KEY do .env
    });
  }

  async validate(payload: any) {
    // O payload contém os dados que o Supabase inseriu no JWT
    return {
      userId: payload.sub,
      tenantId: payload.user_metadata?.tenant_id, // Vinculado à clínica [cite: 40]
      role: payload.user_metadata?.role || 'patient', // Role definida no SQL [cite: 205]
      email: payload.email,
    };
  }
}