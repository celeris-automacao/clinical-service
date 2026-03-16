import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { TenantAddressDto } from './tenant-address.dto';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  legalName: string;

  @IsString()
  @IsNotEmpty()
  cnpj: string;

  @IsUUID()
  planId: string;

  @IsString()
  @IsNotEmpty()
  responsibleName: string;

  @IsEmail()
  responsibleEmail: string;

  @IsOptional()
  @IsString()
  responsiblePhone?: string;

  @ValidateNested()
  @Type(() => TenantAddressDto)
  address: TenantAddressDto;
}
