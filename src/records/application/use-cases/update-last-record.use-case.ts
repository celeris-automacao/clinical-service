import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
import { UpdateRecordDto } from '../../presentation/http/dto/update-record.dto';
import { RECORDS_REPOSITORY } from '../../records.tokens';

@Injectable()
export class UpdateLastRecordUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: RecordsRepositoryPort,
  ) {}

  async execute(recordId: string, targetPatientId: string, user: UserContext, dto: UpdateRecordDto) {
    // O repositório valida internamente se esse recordId é realmente o último
    return this.repository.updateLastRecord(recordId, targetPatientId, user.tenantId, dto);
  }
}
