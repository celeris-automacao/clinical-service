import { ClinicalRecord } from '@prisma/client';
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { RecordsRepositoryPort } from '../../application/ports/records-repository.port';
import { CreateClinicalNoteDto } from '../../presentation/http/dto/create-clinical-note.dto';
import { CreateRecordDto } from '../../presentation/http/dto/create-record.dto';
import { UpdateClinicalNoteDto } from '../../presentation/http/dto/update-clinical-note.dto';
import { UpdateRecordDto } from '../../presentation/http/dto/update-record.dto';

@Injectable()
export class PrismaRecordsRepository implements RecordsRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async create(data: CreateRecordDto, targetPatientId: string, recordedByUserId: string, tenantId: string): Promise<ClinicalRecord> {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: recordedByUserId, tenantId });
    return prisma.clinicalRecord.create({
      data: {
        weight: data.weight,
        skeletalMuscleMass: data.skeletalMuscleMass,
        bodyFatMass: data.bodyFatMass,
        patientId: targetPatientId,
        recordedByUserId,
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

  async updateLastRecord(
    recordId: string,
    patientId: string,
    tenantId: string,
    data: UpdateRecordDto,
  ): Promise<ClinicalRecord> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);

    // Buscar o registro mais recente deste paciente
    const latestRecord = await prisma.clinicalRecord.findFirst({
      where: { patientId, tenantId },
      orderBy: { recordedAt: 'desc' },
    });

    if (!latestRecord) {
      throw new NotFoundException('Nenhum registro encontrado para este paciente.');
    }

    if (latestRecord.id !== recordId) {
      throw new ForbiddenException(
        'Apenas o registro mais recente pode ser editado.',
      );
    }

    return prisma.clinicalRecord.update({
      where: { id: recordId },
      data: {
        weight: data.weight ?? latestRecord.weight,
        skeletalMuscleMass: data.skeletalMuscleMass ?? latestRecord.skeletalMuscleMass,
        bodyFatMass: data.bodyFatMass ?? latestRecord.bodyFatMass,
      },
    });
  }

  async createClinicalNote(data: CreateClinicalNoteDto, authorUserId: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: authorUserId, tenantId });
    return prisma.clinicalNote.create({
      data: {
        tenantId,
        patientId: data.patientId,
        authorUserId,
        encounterType: data.encounterType,
        subjective: data.subjective,
        objective: data.objective,
        assessment: data.assessment,
        plan: data.plan,
        riskLevel: data.riskLevel,
        nextSteps: data.nextSteps,
        consultationAt: new Date(data.consultationAt),
      },
    });
  }

  async listClinicalNotesByPatient(patientId: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.clinicalNote.findMany({
      where: { patientId, tenantId },
      orderBy: { consultationAt: 'desc' },
    });
  }

  async updateClinicalNote(noteId: string, tenantId: string, data: UpdateClinicalNoteDto) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    const existing = await prisma.clinicalNote.findFirst({
      where: { id: noteId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Evolucao clinica nao encontrada.');
    }
    return prisma.clinicalNote.update({
      where: { id: noteId },
      data: {
        encounterType: data.encounterType ?? existing.encounterType,
        subjective: data.subjective ?? existing.subjective,
        objective: data.objective ?? existing.objective,
        assessment: data.assessment ?? existing.assessment,
        plan: data.plan ?? existing.plan,
        riskLevel: data.riskLevel ?? existing.riskLevel,
        nextSteps: data.nextSteps ?? existing.nextSteps,
      },
    });
  }
}
