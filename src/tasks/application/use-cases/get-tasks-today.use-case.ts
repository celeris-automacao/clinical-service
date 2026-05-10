import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
import { TASKS_REPOSITORY } from '../../tasks.tokens';
import { mapTaskAssignmentResponse } from '../utils/task-assignment-response.mapper';

@Injectable()
export class GetTasksTodayUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
  ) {}

  async execute(user: UserContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const assignments = await this.repository.findPendingTasksToday(user.userId, user.tenantId, today);
    return assignments.map(mapTaskAssignmentResponse);
  }
}
