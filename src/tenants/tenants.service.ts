import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ITenantsRepository } from './repositories/interfaces/tenants-repository.interface';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @Inject('ITenantsRepository')
    private readonly tenantsRepository: ITenantsRepository,
  ) {}

  async create(createTenantDto: CreateTenantDto) {
    // Aqui você poderia adicionar lógicas de negócio, como verificar se o nome já existe
    return this.tenantsRepository.create(createTenantDto);
  }

  async findAll() {
    return this.tenantsRepository.findAll();
  }

  async findOne(id: string) {
    const tenant = await this.tenantsRepository.findById(id);
    
    if (!tenant) {
      throw new NotFoundException(`Clínica com ID ${id} não encontrada.`);
    }
    
    return tenant;
  }
}