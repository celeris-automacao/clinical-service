import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRewardDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  requiredDamage: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  goldCost: number;

  @IsOptional()
  @IsString()
  badgeIcon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
