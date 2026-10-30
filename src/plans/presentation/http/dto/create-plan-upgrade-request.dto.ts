import { IsUUID } from 'class-validator';

export class CreatePlanUpgradeRequestDto {
  @IsUUID()
  targetPlanId: string;
}
