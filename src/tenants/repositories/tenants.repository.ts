import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ITenantsRepository } from './interfaces/tenants-repository.interface';
import { CreateTenantDto } from '../dto/create-tenant.dto';

@Injectable()
export class TenantsRepository implements ITenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTenantDto) {
    // Ao criar a clínica, aproveitamos a relação para já criar o primeiro BossBattle [cite: 16]
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        bossBattles: {
          create: {
            name: 'Sedentarismo Voraz',
            maxHp: 100000,
            currentHp: 100000,
            isActive: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: { patients: true } // Mostra quantos pacientes cada clínica tem [cite: 16]
        }
      }
    });
  }
}