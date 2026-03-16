import { IsIn } from 'class-validator';

export const TENANT_STATUSES = ['onboarding', 'active', 'inactive', 'suspended'] as const;

export class ChangeTenantStatusDto {
  @IsIn(TENANT_STATUSES)
  status: string;
}
