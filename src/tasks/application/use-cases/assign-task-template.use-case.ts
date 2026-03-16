import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AssignTaskTemplateDto } from '../../presentation/http/dto/assign-task-template.dto';
import { TASKS_REPOSITORY } from '../../tasks.tokens';
import { TasksRepositoryPort } from '../ports/tasks-repository.port';

@Injectable()
export class AssignTaskTemplateUseCase {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly repository: TasksRepositoryPort,
  ) {}

  async execute(dto: AssignTaskTemplateDto, tenantId: string, assignedByUserId: string) {
    const dueDate = new Date(dto.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      throw new BadRequestException('A atribuicao nao pode ser criada com data no passado.');
    }

    const [template, patient] = await Promise.all([
      this.repository.findTemplateById(dto.templateId, tenantId),
      this.repository.findPatientById(dto.patientId, tenantId),
    ]);

    if (!template) {
      throw new NotFoundException('Template de tarefa nao encontrado.');
    }

    if (!template.isActive) {
      throw new BadRequestException('Nao e permitido atribuir um template inativo.');
    }

    if (!patient) {
      throw new NotFoundException('Paciente nao encontrado na clinica.');
    }

    const duplicate = await this.repository.findActiveAssignment({
      templateId: dto.templateId,
      patientId: dto.patientId,
      tenantId,
      dueDate,
    });

    if (duplicate) {
      throw new BadRequestException(
        'Ja existe uma atribuicao ativa desse template para o paciente na data informada.',
      );
    }

    return this.repository.createAssignment({
      templateId: dto.templateId,
      patientId: dto.patientId,
      tenantId,
      dueDate,
      assignedByUserId,
    });
  }
}
