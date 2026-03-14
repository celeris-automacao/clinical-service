import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto } from '../dto/create-patient.dto';
import { UpdatePatientProfileDto } from '../dto/update-patient-profile.dto';
import { PatientsRepositoryPort } from '../application/ports/patients-repository.port';

@Injectable()
export class PatientsRepository implements PatientsRepositoryPort {
  constructor(private readonly prisma: PrismaService) { }

  async createWithStats(data: CreatePatientDto, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          id: data.supabaseId,
          name: data.name,
          tenantId: tenantId,
          gender: data.gender,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
        },
      });

      // Inicializa o Stats de RPG
      await tx.playerStats.create({
        data: {
          patientId: patient.id,
          tenantId: tenantId,
          currentLevel: 1,
        },
      });

      return patient;
    });
  }

  async findBySupabaseId(id: string) {
    return this.prisma.patient.findUnique({ where: { id } });
  }

  async findById(id: string) {
    return this.prisma.patient.findUnique({ where: { id } });
  }

  async updateProfile(patientId: string, data: UpdatePatientProfileDto) {
  return this.prisma.patientProfile.upsert({
    where: { patientId },
    update: data,
    create: {
      patientId,
      ...data,
    },
  });
}
}
