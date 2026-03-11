import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IPatientsRepository } from './interfaces/patients-repository.interface';
import { CreatePatientDto } from '../dto/create-patient.dto';
@Injectable()
export class PatientsRepository implements IPatientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithStats(data: CreatePatientDto, tenantId: string) {
    // Usamos Transaction para garantir que o herói e seus atributos de RPG sejam criados juntos
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          id: data.supabaseId, // O ID que vem do token do Supabase
          name: data.name,
          tenantId: tenantId,
        },
      });

      await tx.playerStats.create({
        data: {
          patientId: patient.id,
          tenantId: tenantId,
          currentLevel: 1, // Herói começa no nível 1
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