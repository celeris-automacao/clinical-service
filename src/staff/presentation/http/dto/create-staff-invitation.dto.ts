import { Transform } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  STAFF_PROFESSIONAL_TYPES,
  STAFF_ROLES,
} from "../../../domain/staff.constants";

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
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  roleLabel?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
