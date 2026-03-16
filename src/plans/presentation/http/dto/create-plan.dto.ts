import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStaff: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPatients: number;

  @Type(() => Number)
  @Min(0)
  monthlyPrice: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
