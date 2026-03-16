import { IsString } from 'class-validator';

export class AcceptStaffInvitationDto {
  @IsString()
  token: string;
}
