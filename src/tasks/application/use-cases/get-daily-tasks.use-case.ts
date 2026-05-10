import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
import { TASKS_REPOSITORY } from '../../tasks.tokens';
import { mapTaskAssignmentResponse } from '../utils/task-assignment-response.mapper';

@Injectable()
export class GetDailyTasksUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
  ) {}

  async execute(user: UserContext) {
    const assignments = await this.repository.findAssignmentsByPatient(user.userId, user.tenantId);
    return assignments.map(mapTaskAssignmentResponse);
  }
}
