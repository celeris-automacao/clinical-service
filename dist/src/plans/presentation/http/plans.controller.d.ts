import { CreatePlanUseCase } from '../../application/use-cases/create-plan.use-case';
import { GetPlanByIdUseCase } from '../../application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from '../../application/use-cases/get-plans.use-case';
import { CreatePlanDto } from './dto/create-plan.dto';
export declare class PlansController {
    private readonly createPlanUseCase;
    private readonly getPlansUseCase;
    private readonly getPlanByIdUseCase;
    constructor(createPlanUseCase: CreatePlanUseCase, getPlansUseCase: GetPlansUseCase, getPlanByIdUseCase: GetPlanByIdUseCase);
    create(dto: CreatePlanDto): Promise<any>;
    findAll(): Promise<any[]>;
    findOne(id: string): Promise<any>;
}
