import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { Gender } from '@prisma/client';
import { PatientAddressDto } from './patient-address.dto';
import { IsCpf, normalizeCpf } from '../../../../common/validation/cpf.validator';

export class CreatePatientDto {
  @IsOptional()
  @IsUUID()
  supabaseId?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9()\s.-]{10,20}$/)
  phone: string;

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? normalizeCpf(value) : value)
  @IsCpf()
  document: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatientAddressDto)
  address?: PatientAddressDto;

  @IsOptional()
  @IsUUID()
  assignedStaffId?: string;
}
