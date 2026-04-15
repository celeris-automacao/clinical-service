import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Gender } from '@prisma/client';
import { PatientAddressDto } from './patient-address.dto';

export class CreatePatientDto {
  @IsUUID()
  @IsNotEmpty()
  supabaseId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  document?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsOptional()
  @IsUUID()
  responsibleStaffId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatientAddressDto)
  address?: PatientAddressDto;
}
