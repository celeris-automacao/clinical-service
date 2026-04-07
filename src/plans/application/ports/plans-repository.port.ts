import { CreatePlanDto } from '../../presentation/http/dto/create-plan.dto';

export interface PlansRepositoryPort {
  create(data: CreatePlanDto): Promise<any>;
  findAll(): Promise<any[]>;
  findById(id: string): Promise<any | null>;
  findByCode(code: string): Promise<any | null>;
  
  // Upgrade Requests
  createUpgradeRequest(data: { tenantId: string; currentPlanId: string; targetPlanId: string }): Promise<any>;
  findPendingUpgradeRequestByTenantId(tenantId: string): Promise<any | null>;
  findUpgradeRequests(status?: string): Promise<any[]>;
  findUpgradeRequestById(id: string): Promise<any | null>;
  updateUpgradeRequestStatus(id: string, status: string, resolvedBy?: string): Promise<any>;
}
