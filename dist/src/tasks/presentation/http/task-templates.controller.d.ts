import { UserContext } from '../../../shared/auth/user-context';
import { CreateTaskTemplateUseCase } from '../../application/use-cases/create-task-template.use-case';
import { ListTaskTemplatesUseCase } from '../../application/use-cases/list-task-templates.use-case';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
export declare class TaskTemplatesController {
    private readonly createTaskTemplateUseCase;
    private readonly listTaskTemplatesUseCase;
    constructor(createTaskTemplateUseCase: CreateTaskTemplateUseCase, listTaskTemplatesUseCase: ListTaskTemplatesUseCase);
    create(dto: CreateTaskTemplateDto, user: UserContext): Promise<any>;
    list(user: UserContext): Promise<any[]>;
}
