import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { ClinicalProgressCalculator } from '../../domain/services/clinical-progress-calculator';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
import { RECORDS_REPOSITORY } from '../../records.tokens';

@Injectable()
export class GetPatientStatsUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: RecordsRepositoryPort,
    private readonly clinicalProgressCalculator: ClinicalProgressCalculator,
  ) {}

  async execute(user: UserContext) {
    const records = await this.repository.findAllByPatient(user.userId, user.tenantId);

    return {
      patientId: user.userId,
      recordsCount: records.length,
      ...this.clinicalProgressCalculator.calculateStats(records),
    };
  }
}
