import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../common/decorators/get-user.decorator';
import { ClinicalProgressCalculator } from '../../domain/services/clinical-progress-calculator';
import { IRecordsRepository } from '../../repositories/interfaces/records.repository.interface';
import { RECORDS_REPOSITORY } from '../../records.tokens';

@Injectable()
export class GetPatientStatsUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: IRecordsRepository,
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
