// src/records/dto/create-record.dto.ts
import { IsNumber, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRecordDto {
  @IsNumber()
  @Min(20)
  @Max(300)
  @ApiProperty({ example: 83.5, description: 'Peso atual do paciente em kg' })
  weight: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 32.1, description: 'Massa muscular esquelética' })
  skeletal_muscle_mass?: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 18.5, description: 'Massa de gordura corporal' })
  body_fat_mass?: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 22.5, description: 'Percentual de gordura corporal' })
  percent_body_fat?: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 9, description: 'Nível de gordura visceral' })
  visceral_fat_level?: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 1850, description: 'Taxa metabólica basal (kcal)' })
  basal_metabolic_rate?: number;
}