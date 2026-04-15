import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  STAFF_PROFESSIONAL_TYPES,
  STAFF_ROLES,
  STAFF_STATUSES,
} from '../../../domain/staff.constants';

export class ListStaffMembersDto {
  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: string;

  @IsOptional()
  @IsIn(STAFF_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsIn(STAFF_PROFESSIONAL_TYPES)
  professionalType?: string;

  @IsOptional()
  includePatients?: boolean;
}
