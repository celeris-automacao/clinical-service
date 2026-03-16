import { Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { GetStaffMemberByUserIdUseCase } from './get-staff-member-by-user-id.use-case';

@Injectable()
export class GetMyStaffContextUseCase {
  constructor(private readonly getStaffMemberByUserIdUseCase: GetStaffMemberByUserIdUseCase) {}

  async execute(user: UserContext) {
    const staffMember = await this.getStaffMemberByUserIdUseCase.execute(user.userId, user.tenantId);

    return {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      staff: staffMember
        ? {
            id: staffMember.id,
            name: staffMember.name,
            role: staffMember.role,
            status: staffMember.status,
            specialty: staffMember.specialty,
            professionalType: staffMember.professionalType,
            licenseNumber: staffMember.licenseNumber,
          }
        : null,
    };
  }
}
