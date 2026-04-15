import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
import { RECORDS_REPOSITORY } from '../../records.tokens';

@Injectable()
export class GetPatientRecordsForDoctorUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: RecordsRepositoryPort,
  ) {}

  async execute(targetPatientId: string, user: UserContext) {
    const records = await this.repository.findAllByPatient(targetPatientId, user.tenantId);

    return records.map((record) => ({
      id: record.id,
      recordedAt: record.recordedAt,
      weight: Number(record.weight),
      skeletalMuscleMass: record.skeletalMuscleMass ? Number(record.skeletalMuscleMass) : null,
      bodyFatMass: record.bodyFatMass ? Number(record.bodyFatMass) : null,
      recordedByUserId: record.recordedByUserId,
      // true = auto-registro pelo paciente, false = inserido pelo médico
      isSelfRegistered: record.recordedByUserId === targetPatientId,
    }));
  }
}
