import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePatientDto } from '../../presentation/http/dto/create-patient.dto';

@Injectable()
export class PrismaTenantPatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithStats(data: CreatePatientDto, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          id: data.supabaseId,
          name: data.name,
          tenantId,
        },
      });

      await tx.playerStats.create({
        data: {
          patientId: patient.id,
          tenantId,
          currentLevel: 1,
          currentXp: 0,
          currentGold: 0,
          totalDamageDealt: 0,
        },
      });

      return patient;
    });
  }

  async findBySupabaseId(id: string) {
    return this.prisma.patient.findUnique({ where: { id } });
  }
}
