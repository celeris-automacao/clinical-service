import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../common/decorators/get-user.decorator';
import { ITasksRepository } from '../ports/tasks-repository.port';
import { TASKS_REPOSITORY } from '../../tasks.tokens';

@Injectable()
export class GetTasksTodayUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: ITasksRepository,
  ) {}

  async execute(user: UserContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.repository.findPendingTasksToday(user.userId, user.tenantId, today);
  }
}
