// src/records/infrastructure/persistence/prisma-records.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IRecordsRepository } from '../../repositories/interfaces/records.repository.interface';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';
import { ClinicalRecord } from '@prisma/client';

@Injectable()
export class PrismaRecordsRepository implements IRecordsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(data: CreateRecordDto, userId: string, tenantId: string): Promise<ClinicalRecord> {
    return this.prisma.clinicalRecord.create({
      data: {
        weight: data.weight,
        skeletalMuscleMass: data.skeletalMuscleMass,
        bodyFatMass: data.bodyFatMass,
        patientId: userId,
        tenantId: tenantId,
      },
    });
  }

  async findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]> {
    return this.prisma.clinicalRecord.findMany({
      where: { patientId, tenantId },
      orderBy: { recordedAt: 'asc' }, // Essencial para o cálculo de evolução
    });
  }

  async findLastTwo(patientId: string): Promise<ClinicalRecord[]> {
    return this.prisma.clinicalRecord.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: 2, // Para comparar o peso atual com o anterior
    });
  }

  async getClinicalDamageByTenant(tenantId: string) {
    // Busca todos os registros de peso da clínica ordenados por data
    const allRecords = await this.prisma.clinicalRecord.findMany({
      where: { tenantId },
      select: { patientId: true, weight: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });

    // Agrupa e calcula o dano (perda de peso) por paciente
    const damageMap = new Map<string, number>();

    // Lógica de cálculo: soma apenas as diferenças positivas (perda de peso)
    const patientGroups = allRecords.reduce<Record<string, typeof allRecords>>((groups, record) => {
      if (!groups[record.patientId]) groups[record.patientId] = [];
      groups[record.patientId].push(record);
      return groups;
    }, {});

    Object.entries(patientGroups).forEach(([patientId, records]) => {
      let totalLoss = 0;
      for (let i = 1; i < records.length; i++) {
        const diff = Number(records[i - 1].weight) - Number(records[i].weight);
        if (diff > 0) totalLoss += diff;
      }
      damageMap.set(patientId, Math.round(totalLoss * 7700)); // Aplica a constante de 7700
    });

    return damageMap;
  }
}
