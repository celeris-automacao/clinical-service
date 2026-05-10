import { Inject, Injectable } from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { RecordsRepositoryPort } from '../ports/records-repository.port';
import { RECORDS_REPOSITORY } from '../../records.tokens';
import { UpdateClinicalNoteDto } from '../../presentation/http/dto/update-clinical-note.dto';

@Injectable()
export class UpdateClinicalNoteUseCase {
  constructor(
    @Inject(RECORDS_REPOSITORY)
    private readonly repository: RecordsRepositoryPort,
  ) {}

  async execute(noteId: string, dto: UpdateClinicalNoteDto, user: UserContext) {
    return this.repository.updateClinicalNote(noteId, user.tenantId, dto);
  }
}

