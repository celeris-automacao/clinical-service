// src/records/dto/evolution.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EvolutionDto {
  @ApiProperty({ example: '2026-02-05T14:00:00Z' })
  recordedAt: Date;

  @ApiProperty({ example: 83.5 })
  weight: number;

  @ApiPropertyOptional({ example: 32.1 })
  skeletalMuscleMass?: number;

  @ApiPropertyOptional({ example: 18.5 })
  bodyFatMass?: number;

  @ApiPropertyOptional({ example: 7700, description: 'Dano causado ao Boss neste registro' })
  damageDealt?: number;
}