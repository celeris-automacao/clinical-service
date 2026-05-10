import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRecordDto {
  @IsNumber()
  @IsOptional()
  @Min(20)
  @Max(300)
  @ApiPropertyOptional({ example: 82.5, description: 'Novo peso em kg' })
  weight?: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 33.0, description: 'Nova massa muscular esquelética' })
  skeletalMuscleMass?: number;

  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 17.0, description: 'Nova massa de gordura corporal' })
  bodyFatMass?: number;
}
