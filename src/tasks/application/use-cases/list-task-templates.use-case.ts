import { Inject, Injectable } from '@nestjs/common';
import { TASKS_REPOSITORY } from '../../tasks.tokens';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';

@Injectable()
export class ListTaskTemplatesUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
  ) {}

  execute(tenantId: string) {
    return this.repository.listTemplatesByTenant(tenantId);
  }
}
