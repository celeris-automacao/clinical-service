import { ClinicalRecord } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { RecordsRepositoryPort } from '../../application/ports/records-repository.port';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';

@Injectable()
export class PrismaRecordsRepository implements RecordsRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async create(data: CreateRecordDto, userId: string, tenantId: string): Promise<ClinicalRecord> {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId, tenantId });
    return prisma.clinicalRecord.create({
      data: {
        weight: data.weight,
        skeletalMuscleMass: data.skeletalMuscleMass,
        bodyFatMass: data.bodyFatMass,
        patientId: userId,
        tenantId,
      },
    });
  }

  async findAllByPatient(patientId: string, tenantId: string): Promise<ClinicalRecord[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId, patientId);
    return prisma.clinicalRecord.findMany({
      where: { patientId, tenantId },
      orderBy: { recordedAt: 'asc' },
    });
  }

  async findLastTwo(patientId: string, tenantId: string): Promise<ClinicalRecord[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId, patientId);
    return prisma.clinicalRecord.findMany({
      where: { patientId, tenantId },
      orderBy: { recordedAt: 'desc' },
      take: 2,
    });
  }

  async getClinicalDamageByTenant(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    const allRecords = await prisma.clinicalRecord.findMany({
      where: { tenantId },
      select: { patientId: true, weight: true, recordedAt: true },
      orderBy: { recordedAt: 'asc' },
    });

    const damageMap = new Map<string, number>();
    const patientGroups = allRecords.reduce<Record<string, typeof allRecords>>((groups, record) => {
      if (!groups[record.patientId]) {
        groups[record.patientId] = [];
      }
      groups[record.patientId].push(record);
      return groups;
    }, {});

    Object.entries(patientGroups).forEach(([patientId, records]) => {
      let totalLoss = 0;
      for (let i = 1; i < records.length; i += 1) {
        const diff = Number(records[i - 1].weight) - Number(records[i].weight);
        if (diff > 0) {
          totalLoss += diff;
        }
      }
      damageMap.set(patientId, Math.round(totalLoss * 7700));
    });

    return damageMap;
  }
}
