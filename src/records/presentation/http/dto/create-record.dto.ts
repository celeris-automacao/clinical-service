import { IsNumber, Min, Max, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRecordDto {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ description: 'ID do paciente (se inserido por um médico)' })
  patientId?: string;

  @IsNumber()
  @Min(20)
  @Max(300)
  @ApiProperty({ example: 83.5, description: 'Peso atual do paciente em kg' })
  weight: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 32.1, description: 'Massa muscular esquelética' })
  skeletalMuscleMass?: number; // Mudou de skeletal_muscle_mass para camelCase

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 18.5, description: 'Massa de gordura corporal' })
  bodyFatMass?: number; // Mudou de body_fat_mass para camelCase

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 22.5, description: 'Percentual de gordura corporal' })
  percentBodyFat?: number; // Padronizando o restante

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 9, description: 'Nível de gordura visceral' })
  visceralFatLevel?: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 1850, description: 'Taxa metabólica basal (kcal)' })
  basalMetabolicRate?: number;
}