import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TASK_TYPES } from '../../../domain/task.constants';

export class CreateTaskTemplateDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(TASK_TYPES)
  taskType: string;

  @Type(() => Number)
  @IsInt()
  @Min(50)
  @Max(500)
  xpReward: number;
}
