import { CreatePlanUseCase } from '../../application/use-cases/create-plan.use-case';
import { GetPlanByIdUseCase } from '../../application/use-cases/get-plan-by-id.use-case';
import { GetPlansUseCase } from '../../application/use-cases/get-plans.use-case';
import { RequestPlanUpgradeUseCase } from '../../application/use-cases/request-plan-upgrade.use-case';
import { GetPendingUpgradeRequestUseCase } from '../../application/use-cases/get-pending-upgrade-request.use-case';
import { GetUpgradeRequestsUseCase } from '../../application/use-cases/get-upgrade-requests.use-case';
import { ResolveUpgradeRequestUseCase } from '../../application/use-cases/resolve-upgrade-request.use-case';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateUpgradeRequestDto } from './dto/create-upgrade-request.dto';
import { UserContext } from '../../../shared/auth/user-context';
export declare class PlansController {
    private readonly createPlanUseCase;
    private readonly getPlansUseCase;
    private readonly getPlanByIdUseCase;
    private readonly requestPlanUpgradeUseCase;
    private readonly getPendingUpgradeRequestUseCase;
    private readonly getUpgradeRequestsUseCase;
    private readonly resolveUpgradeRequestUseCase;
    constructor(createPlanUseCase: CreatePlanUseCase, getPlansUseCase: GetPlansUseCase, getPlanByIdUseCase: GetPlanByIdUseCase, requestPlanUpgradeUseCase: RequestPlanUpgradeUseCase, getPendingUpgradeRequestUseCase: GetPendingUpgradeRequestUseCase, getUpgradeRequestsUseCase: GetUpgradeRequestsUseCase, resolveUpgradeRequestUseCase: ResolveUpgradeRequestUseCase);
    create(dto: CreatePlanDto): Promise<any>;
    findAll(): Promise<any[]>;
    findOne(id: string): Promise<any>;
    getPendingRequest(user: UserContext): Promise<any>;
    requestUpgrade(user: UserContext, dto: CreateUpgradeRequestDto): Promise<any>;
    getUpgradeRequests(status?: string): Promise<any[]>;
    resolveUpgradeRequest(id: string, action: 'approve' | 'reject', user: UserContext): Promise<any>;
}
