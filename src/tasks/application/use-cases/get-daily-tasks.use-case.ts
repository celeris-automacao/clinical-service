import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';
import { TASKS_REPOSITORY } from '../../tasks.tokens';

@Injectable()
export class GetDailyTasksUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
  ) {}

  async execute(user: UserContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [tasks, completions] = await Promise.all([
      this.repository.findTasksByTenant(user.tenantId),
      this.repository.findCompletionsByPatientToday(user.userId, today),
    ]);

    return tasks.map((task) => ({
      ...task,
      completed: completions.some((completion) => completion.taskId === task.id),
    }));
  }
}
