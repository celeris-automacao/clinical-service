import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateTaskTemplateDto } from '../../presentation/http/dto/create-task-template.dto';
import { TASKS_REPOSITORY } from '../../tasks.tokens';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';

@Injectable()
export class CreateTaskTemplateUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
  ) {}

  async execute(dto: CreateTaskTemplateDto, tenantId: string, createdByUserId: string) {
    const existing = await this.repository.findTemplateByTitleAndType(dto.title, dto.taskType, tenantId);

    if (existing) {
      throw new BadRequestException('Ja existe um template de tarefa com esse titulo e tipo.');
    }

    return this.repository.createTemplate({
      ...dto,
      tenantId,
      createdByUserId,
    });
  }
}
