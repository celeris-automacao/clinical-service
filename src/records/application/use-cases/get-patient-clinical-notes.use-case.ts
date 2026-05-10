import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
import { RECORDS_REPOSITORY } from '../../records.tokens';

@Injectable()
export class GetPatientClinicalNotesUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: RecordsRepositoryPort,
  ) {}

  async execute(patientId: string, user: UserContext) {
    return this.repository.listClinicalNotesByPatient(patientId, user.tenantId);
  }
}

