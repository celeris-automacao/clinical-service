import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateUpgradeRequestDto {
  @IsNotEmpty()
  @IsUUID('4')
  targetPlanId: string;
}
