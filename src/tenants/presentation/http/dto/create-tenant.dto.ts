import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string; // Nome da Clínica (ex: "Clínica Vida Saudável")
}