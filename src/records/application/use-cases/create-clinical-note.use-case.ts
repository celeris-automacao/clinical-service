import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
import { RECORDS_REPOSITORY } from '../../records.tokens';
import { CreateClinicalNoteDto } from '../../presentation/http/dto/create-clinical-note.dto';

@Injectable()
export class CreateClinicalNoteUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: RecordsRepositoryPort,
  ) {}

  async execute(dto: CreateClinicalNoteDto, user: UserContext) {
    return this.repository.createClinicalNote(dto, user.userId, user.tenantId);
  }
}

