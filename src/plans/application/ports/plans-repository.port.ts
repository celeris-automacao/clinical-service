import { CreatePlanDto } from '../../presentation/http/dto/create-plan.dto';

export interface PlansRepositoryPort {
  create(data: CreatePlanDto): Promise<any>;
  findAll(): Promise<any[]>;
  findById(id: string): Promise<any | null>;
  findByCode(code: string): Promise<any | null>;
  findTenantCurrentPlanId(tenantId: string): Promise<string | null>;
  findPendingUpgradeRequest(tenantId: string): Promise<any | null>;
  createUpgradeRequest(data: {
    tenantId: string;
    currentPlanId: string;
    targetPlanId: string;
    requestedByUserId: string;
  }): Promise<any>;
}
