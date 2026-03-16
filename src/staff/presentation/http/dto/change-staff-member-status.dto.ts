import { IsIn } from 'class-validator';
import { STAFF_STATUSES } from '../../../domain/staff.constants';

export class ChangeStaffMemberStatusDto {
  @IsIn(STAFF_STATUSES)
  status: string;
}
