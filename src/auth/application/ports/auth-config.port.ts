export interface AuthConfigPort {
  getSupabaseJwtSecret(): string;
  getSupabaseUrl(): string;
}
