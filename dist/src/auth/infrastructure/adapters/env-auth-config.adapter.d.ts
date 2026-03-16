import { AuthConfigPort } from '../../application/ports/auth-config.port';
export declare class EnvAuthConfigAdapter implements AuthConfigPort {
    getSupabaseJwtSecret(): string;
}
