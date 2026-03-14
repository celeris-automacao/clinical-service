import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
import { RECORDS_REPOSITORY } from '../../records.tokens';

@Injectable()
export class GetPatientEvolutionUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: RecordsRepositoryPort,
  ) {}

  async execute(user: UserContext) {
    const records = await this.repository.findAllByPatient(user.userId, user.tenantId);

    return records.map((record) => ({
      recordedAt: record.recordedAt,
      weight: Number(record.weight),
      skeletalMuscleMass: record.skeletalMuscleMass ? Number(record.skeletalMuscleMass) : null,
      bodyFatMass: record.bodyFatMass ? Number(record.bodyFatMass) : null,
    }));
  }
}
