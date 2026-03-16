import { Inject, Injectable } from '@nestjs/common';
import { BulkAssignTaskTemplateDto } from '../../presentation/http/dto/bulk-assign-task-template.dto';
import { AssignTaskTemplateUseCase } from './assign-task-template.use-case';

@Injectable()
export class BulkAssignTaskTemplateUseCase {
  constructor(private readonly assignTaskTemplateUseCase: AssignTaskTemplateUseCase) {}

  async execute(dto: BulkAssignTaskTemplateDto, tenantId: string, assignedByUserId: string) {
    const uniquePatientIds = [...new Set(dto.patientIds)];

    const results = await Promise.all(
      uniquePatientIds.map((patientId) =>
        this.assignTaskTemplateUseCase.execute(
          {
            templateId: dto.templateId,
            patientId,
            dueDate: dto.dueDate,
          },
          tenantId,
          assignedByUserId,
        ),
      ),
    );

    return {
      assignmentsCreated: results.length,
      assignments: results,
    };
  }
}
