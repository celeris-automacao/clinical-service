import { CreatePlanDto } from '../../presentation/http/dto/create-plan.dto';

export interface PlansRepositoryPort {
  create(data: CreatePlanDto): Promise<any>;
  findAll(): Promise<any[]>;
  findById(id: string): Promise<any | null>;
  findByCode(code: string): Promise<any | null>;
}
