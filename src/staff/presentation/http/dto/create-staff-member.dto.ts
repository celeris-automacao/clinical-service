import { Transform } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import {
  STAFF_PROFESSIONAL_TYPES,
  STAFF_ROLES,
  STAFF_STATUSES,
} from "../../../domain/staff.constants";

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
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  roleLabel?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsIn(STAFF_STATUSES)
  status?: string;
}
