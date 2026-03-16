import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { STAFF_PROFESSIONAL_TYPES, STAFF_ROLES } from '../../../domain/staff.constants';

export class CreateStaffInvitationDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  document: string;

  @IsIn(STAFF_PROFESSIONAL_TYPES)
  professionalType: string;

  @IsString()
  specialty: string;

  @IsIn(STAFF_ROLES)
  role: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
