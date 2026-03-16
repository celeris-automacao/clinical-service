import { IsEmail, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  STAFF_PROFESSIONAL_TYPES,
  STAFF_ROLES,
  STAFF_STATUSES,
} from '../../../domain/staff.constants';

export class CreateStaffMemberDto {
  @IsUUID()
  userId: string;

  @IsString()
  name: string;

  @IsString()
  document: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn(STAFF_PROFESSIONAL_TYPES)
  professionalType: string;

  @IsString()
  specialty: string;

  @IsIn(STAFF_ROLES)
  role: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsIn(STAFF_STATUSES)
  status?: string;
}
