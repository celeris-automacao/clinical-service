import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SupabaseGuard } from '../../../auth/guards/supabase.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserContext } from '../../../shared/auth/user-context';
import { ChangeStaffMemberStatusUseCase } from '../../application/use-cases/change-staff-member-status.use-case';
import { AcceptStaffInvitationUseCase } from '../../application/use-cases/accept-staff-invitation.use-case';
import { CleanupExpiredStaffInvitationsUseCase } from '../../application/use-cases/cleanup-expired-staff-invitations.use-case';
import { CreateStaffMemberUseCase } from '../../application/use-cases/create-staff-member.use-case';
import { CreateStaffInvitationUseCase } from '../../application/use-cases/create-staff-invitation.use-case';
import { GetStaffMemberByIdUseCase } from '../../application/use-cases/get-staff-member-by-id.use-case';
import { GetMyStaffContextUseCase } from '../../application/use-cases/get-my-staff-context.use-case';
import { ListStaffAuditLogsUseCase } from '../../application/use-cases/list-staff-audit-logs.use-case';
import { ListPendingStaffInvitationsUseCase } from '../../application/use-cases/list-pending-staff-invitations.use-case';
import { ListStaffMembersUseCase } from '../../application/use-cases/list-staff-members.use-case';
import { RevokeStaffInvitationUseCase } from '../../application/use-cases/revoke-staff-invitation.use-case';
import { UpdateStaffMemberUseCase } from '../../application/use-cases/update-staff-member.use-case';
import { ChangeStaffMemberStatusDto } from './dto/change-staff-member-status.dto';
import { AcceptStaffInvitationDto } from './dto/accept-staff-invitation.dto';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { CreateStaffInvitationDto } from './dto/create-staff-invitation.dto';
import { ListStaffMembersDto } from './dto/list-staff-members.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';

@UseGuards(SupabaseGuard, RolesGuard)
@Roles('owner', 'admin')
@Controller('staff')
export class StaffController {
  constructor(
    private readonly createStaffMemberUseCase: CreateStaffMemberUseCase,
    private readonly acceptStaffInvitationUseCase: AcceptStaffInvitationUseCase,
    private readonly cleanupExpiredStaffInvitationsUseCase: CleanupExpiredStaffInvitationsUseCase,
    private readonly createStaffInvitationUseCase: CreateStaffInvitationUseCase,
    private readonly getMyStaffContextUseCase: GetMyStaffContextUseCase,
    private readonly listStaffMembersUseCase: ListStaffMembersUseCase,
    private readonly listPendingStaffInvitationsUseCase: ListPendingStaffInvitationsUseCase,
    private readonly listStaffAuditLogsUseCase: ListStaffAuditLogsUseCase,
    private readonly revokeStaffInvitationUseCase: RevokeStaffInvitationUseCase,
    private readonly getStaffMemberByIdUseCase: GetStaffMemberByIdUseCase,
    private readonly updateStaffMemberUseCase: UpdateStaffMemberUseCase,
    private readonly changeStaffMemberStatusUseCase: ChangeStaffMemberStatusUseCase,
  ) {}

  @Post()
  create(@Body() dto: CreateStaffMemberDto, @GetUser() user: UserContext) {
    return this.createStaffMemberUseCase.execute(dto, user.tenantId, user.userId);
  }

  @Post('invitations')
  invite(@Body() dto: CreateStaffInvitationDto, @GetUser() user: UserContext) {
    return this.createStaffInvitationUseCase.execute(dto, user.tenantId, user.userId);
  }

  @Post('invitations/accept')
  @Roles('patient', 'owner', 'admin', 'doctor', 'specialist', 'staff')
  acceptInvitation(@Body() dto: AcceptStaffInvitationDto, @GetUser() user: UserContext) {
    return this.acceptStaffInvitationUseCase.execute(dto, user);
  }

  @Get('me/context')
  @Roles('patient', 'owner', 'admin', 'doctor', 'specialist', 'staff')
  getMyContext(@GetUser() user: UserContext) {
    return this.getMyStaffContextUseCase.execute(user);
  }

  @Get('invitations/pending')
  listPendingInvitations(@GetUser() user: UserContext) {
    return this.listPendingStaffInvitationsUseCase.execute(user.tenantId);
  }

  @Get()
  findAll(@Query() filters: ListStaffMembersDto, @GetUser() user: UserContext) {
    return this.listStaffMembersUseCase.execute(user.tenantId, filters);
  }

  @Get('audit-logs')
  listAuditLogs(@GetUser() user: UserContext) {
    return this.listStaffAuditLogsUseCase.execute(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: UserContext) {
    return this.getStaffMemberByIdUseCase.execute(id, user.tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffMemberDto,
    @GetUser() user: UserContext,
  ) {
    return this.updateStaffMemberUseCase.execute(id, user.tenantId, dto, user.userId);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStaffMemberStatusDto,
    @GetUser() user: UserContext,
  ) {
    return this.changeStaffMemberStatusUseCase.execute(id, user.tenantId, dto.status, user.userId);
  }

  @Patch('invitations/:id/revoke')
  revokeInvitation(@Param('id') id: string, @GetUser() user: UserContext) {
    return this.revokeStaffInvitationUseCase.execute(id, user.tenantId, user.userId);
  }

  @Post('invitations/cleanup')
  cleanupExpiredInvitations() {
    return this.cleanupExpiredStaffInvitationsUseCase.execute();
  }
}
