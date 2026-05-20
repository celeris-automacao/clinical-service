import { Injectable } from '@nestjs/common';
import { byIdAndTenant, byTenant } from '../../../shared/infrastructure/persistence/tenant-scope';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { TasksRepositoryPort } from '../../application/ports/tasks-repository.port';

@Injectable()
export class PrismaTasksRepository implements TasksRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async createTemplate(data: {
    tenantId: string;
    title: string;
    description?: string;
    taskType: string;
    xpReward: number;
    createdByUserId: string;
  }) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(data.tenantId);
    return prisma.taskTemplate.create({ data });
  }

  async findTemplateByTitleAndType(title: string, taskType: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.taskTemplate.findFirst({
      where: byTenant(tenantId, { title, taskType }),
    });
  }

  async findTemplateById(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.taskTemplate.findFirst({
      where: byIdAndTenant(id, tenantId),
    });
  }

  async listTemplatesByTenant(tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.taskTemplate.findMany({
      where: byTenant(tenantId),
      orderBy: [{ isActive: 'desc' }, { title: 'asc' }],
    });
  }

  async createAssignment(data: {
    templateId: string;
    patientId: string;
    tenantId: string;
    dueDate: Date;
    assignedByUserId: string;
  }) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(data.tenantId);
    return prisma.taskAssignment.create({
      data: {
        ...data,
        status: 'pending',
      },
      include: {
        template: true,
      },
    });
  }

  async findAssignmentsByPatient(patientId: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
    return prisma.taskAssignment.findMany({
      where: byTenant(tenantId, { patientId }),
      include: { template: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findAssignmentsByPatientOnDate(patientId: string, tenantId: string, dueDate: Date) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
    return prisma.taskAssignment.findMany({
      where: byTenant(tenantId, { patientId, dueDate }),
      include: { template: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAssignmentById(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.taskAssignment.findFirst({
      where: byIdAndTenant(id, tenantId),
      include: { template: true },
    });
  }

  async findAssignmentByIdForTenant(id: string, tenantId: string) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.taskAssignment.findFirst({
      where: byIdAndTenant(id, tenantId),
      include: { template: true },
    });
  }

  async findPatientById(patientId: string, tenantId: string): Promise<{ id: string } | null> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.patient.findFirst({
      where: byIdAndTenant(patientId, tenantId),
      select: { id: true },
    });
  }

  async findActiveAssignment(input: {
    patientId: string;
    tenantId: string;
    templateId: string;
    dueDate: Date;
  }) {
    const prisma = this.tenantScopedPrismaFactory.forTenant(input.tenantId);
    return prisma.taskAssignment.findFirst({
      where: {
        ...byTenant(input.tenantId, {
          patientId: input.patientId,
          templateId: input.templateId,
        }),
        dueDate: input.dueDate,
        status: { in: ['pending', 'completed'] },
      },
    });
  }

  async findPendingTasksToday(userId: string, tenantId: string, today: Date) {
    const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId, tenantId });
    return prisma.taskAssignment.findMany({
      where: byTenant(tenantId, {
        patientId: userId,
        status: 'pending',
        dueDate: today,
      }),
      include: { template: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPlayerStatsRanking(tenantId: string): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.playerStats.findMany({
      where: byTenant(tenantId),
      select: {
        patientId: true,
        currentLevel: true,
        currentXp: true,
        totalDamageDealt: true,
        patient: { select: { id: true, name: true } },
      },
      orderBy: [{ currentLevel: 'desc' }, { currentXp: 'desc' }, { totalDamageDealt: 'desc' }],
    });
  }

  async findPatientsWithActivity(tenantId: string): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.patient.findMany({
      where: byTenant(tenantId),
      include: {
        clinicalRecords: true,
        taskAssignments: {
          where: { status: 'completed' },
          include: { template: true },
        },
      },
    });
  }
}
