import { IsString, IsNotEmpty, IsUUID, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { Gender } from '@prisma/client';

export class CreatePatientDto {
  @IsUUID()
  @IsNotEmpty()
  supabaseId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  birthDate?: string;
}