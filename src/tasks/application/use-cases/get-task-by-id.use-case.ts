import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { TASKS_REPOSITORY } from '../../tasks.tokens';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
import { mapTaskAssignmentResponse } from '../utils/task-assignment-response.mapper';

@Injectable()
export class GetTaskByIdUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
  ) {}

  async execute(taskAssignmentId: string, user: UserContext) {
    const assignment = await this.repository.findAssignmentByIdForTenant(taskAssignmentId, user.tenantId);

    if (!assignment) {
      throw new BadRequestException('Missao nao encontrada.');
    }

    const canReadAny = ['owner', 'admin', 'doctor', 'specialist', 'staff'].includes(user.role);
    const isOwnerPatient = assignment.patientId === user.userId;

    if (!canReadAny && !isOwnerPatient) {
      throw new ForbiddenException('Sem permissao para visualizar esta missao.');
    }

    return mapTaskAssignmentResponse(assignment);
  }
}
