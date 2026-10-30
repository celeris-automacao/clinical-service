import { ExecutionContext, ForbiddenException, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StaffController } from '../../staff/presentation/http/staff.controller';
import { UpdateStaffMemberDto } from '../../staff/presentation/http/dto/update-staff-member.dto';
import { validate } from 'class-validator';

describe('commercial authorization', () => {
  const guard = new RolesGuard(new Reflector());

  function canActivate(
    controller: Type<unknown>,
    handler: Function,
    role: string,
  ) {
    const context = {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  }

  it.each(['doctor', 'specialist', 'staff', 'assistant'])(
    'allows %s to read their own staff context and blocks price updates',
    (role) => {
      expect(
        canActivate(
          StaffController,
          StaffController.prototype.getMyContext,
          role,
        ),
      ).toBe(true);
      expect(() =>
        canActivate(StaffController, StaffController.prototype.update, role),
      ).toThrow(ForbiddenException);
    },
  );

  it.each(['owner', 'admin'])('allows %s to update staff pricing', (role) => {
    expect(
      canActivate(StaffController, StaffController.prototype.update, role),
    ).toBe(true);
  });

  it.each([-1, 10.123, 100000000])(
    'rejects invalid private consultation prices (%s)',
    async (privateConsultationPrice) => {
      const dto = Object.assign(new UpdateStaffMemberDto(), {
        privateConsultationPrice,
      });
      const errors = await validate(dto);
      expect(
        errors.some((error) => error.property === 'privateConsultationPrice'),
      ).toBe(true);
    },
  );
});
