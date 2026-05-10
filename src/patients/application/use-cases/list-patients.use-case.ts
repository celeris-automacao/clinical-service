import { Inject, Injectable } from '@nestjs/common';
import { PATIENTS_REPOSITORY } from '../../patients.tokens';
import { PatientsRepositoryPort } from '../ports/patients-repository.port';
import { ListPatientsDto } from '../../presentation/http/dto/list-patients.dto';

@Injectable()
export class ListPatientsUseCase {
  constructor(
    @Inject(PATIENTS_REPOSITORY)
    private readonly repository: PatientsRepositoryPort,
  ) {}

  async execute(tenantId: string, filters: ListPatientsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const allPatients = await this.repository.findAllByTenant(tenantId, filters.search);
    const start = (page - 1) * limit;
    const items = allPatients.slice(start, start + limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total: allPatients.length,
        totalPages: Math.ceil(allPatients.length / limit) || 1,
      },
    };
  }
}
