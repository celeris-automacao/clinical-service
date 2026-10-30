import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserContext } from '../../../shared/auth/user-context';
import { TENANTS_REPOSITORY } from '../../tenants.tokens';
import { TenantsRepositoryPort } from '../ports/tenants-repository.port';

@Injectable()
export class UpdateTenantContactEmailUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY)
    private readonly repository: TenantsRepositoryPort,
  ) {}

  async execute(id: string, email: string, user: UserContext) {
    if (!['owner', 'admin'].includes(user.role) || user.tenantId !== id) {
      throw new ForbiddenException(
        'Sem permissao para alterar o e-mail de contato desta clinica.',
      );
    }
    const tenant = await this.repository.findById(id);
    if (!tenant) {
      throw new NotFoundException('Clinica nao encontrada.');
    }
    return this.repository.updateResponsibleEmail(id, email);
  }
}
