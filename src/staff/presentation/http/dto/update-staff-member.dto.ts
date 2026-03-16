import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { STAFF_PROFESSIONAL_TYPES, STAFF_ROLES } from '../../../domain/staff.constants';

export class UpdateStaffMemberDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(STAFF_PROFESSIONAL_TYPES)
  professionalType?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
