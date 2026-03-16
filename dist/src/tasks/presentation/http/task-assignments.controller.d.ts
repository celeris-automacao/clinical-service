import { UserContext } from '../../../shared/auth/user-context';
import { AssignTaskTemplateUseCase } from '../../application/use-cases/assign-task-template.use-case';
import { BulkAssignTaskTemplateUseCase } from '../../application/use-cases/bulk-assign-task-template.use-case';
import { AssignTaskTemplateDto } from './dto/assign-task-template.dto';
import { BulkAssignTaskTemplateDto } from './dto/bulk-assign-task-template.dto';
export declare class TaskAssignmentsController {
    private readonly assignTaskTemplateUseCase;
    private readonly bulkAssignTaskTemplateUseCase;
    constructor(assignTaskTemplateUseCase: AssignTaskTemplateUseCase, bulkAssignTaskTemplateUseCase: BulkAssignTaskTemplateUseCase);
    assign(dto: AssignTaskTemplateDto, user: UserContext): Promise<any>;
    bulkAssign(dto: BulkAssignTaskTemplateDto, user: UserContext): Promise<{
        assignmentsCreated: number;
        assignments: any[];
    }>;
}
