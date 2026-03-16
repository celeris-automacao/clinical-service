import { Strategy } from 'passport-jwt';
import { MapSupabaseUserUseCase } from '../application/use-cases/map-supabase-user.use-case';
import { AuthConfigPort } from '../application/ports/auth-config.port';
declare const SupabaseStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class SupabaseStrategy extends SupabaseStrategy_base {
    private readonly mapSupabaseUserUseCase;
    constructor(authConfigPort: AuthConfigPort, mapSupabaseUserUseCase: MapSupabaseUserUseCase);
    validate(payload: any): Promise<{
        userId: any;
        tenantId: any;
        role: any;
        staffId: any;
        email: any;
    }>;
}
export {};
