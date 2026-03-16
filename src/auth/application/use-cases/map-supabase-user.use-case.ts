import { Injectable, UnauthorizedException } from '@nestjs/common';
import { GetStaffMemberByUserIdUseCase } from '../../../staff/application/use-cases/get-staff-member-by-user-id.use-case';

@Injectable()
export class MapSupabaseUserUseCase {
  constructor(private readonly getStaffMemberByUserIdUseCase: GetStaffMemberByUserIdUseCase) {}

  async execute(payload: any) {
    const userId = payload?.sub;
    const tenantId = payload?.user_metadata?.tenant_id;

    if (!userId || !tenantId) {
      throw new UnauthorizedException('JWT sem contexto de tenant ou usuario.');
    }

    const staffMember = await this.getStaffMemberByUserIdUseCase.execute(userId, tenantId);

    if (staffMember && staffMember.status !== 'active') {
      throw new UnauthorizedException('Profissional inativo ou bloqueado.');
    }

    return {
      userId,
      tenantId,
      role: staffMember?.role || payload.user_metadata?.role || 'patient',
      staffId: staffMember?.id,
      email: payload.email,
    };
  }
}
