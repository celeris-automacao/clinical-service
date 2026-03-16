import { BulkAssignTaskTemplateDto } from '../../presentation/http/dto/bulk-assign-task-template.dto';
import { AssignTaskTemplateUseCase } from './assign-task-template.use-case';
export declare class BulkAssignTaskTemplateUseCase {
    private readonly assignTaskTemplateUseCase;
    constructor(assignTaskTemplateUseCase: AssignTaskTemplateUseCase);
    execute(dto: BulkAssignTaskTemplateDto, tenantId: string, assignedByUserId: string): Promise<{
        assignmentsCreated: number;
        assignments: any[];
    }>;
}
