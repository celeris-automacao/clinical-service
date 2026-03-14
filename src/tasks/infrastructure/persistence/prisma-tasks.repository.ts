import { DailyTask, TaskCompletion } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { byIdAndTenant, byTenant } from '../../../shared/infrastructure/persistence/tenant-scope';
import { TenantScopedPrismaFactory } from '../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory';
import { TasksRepositoryPort } from '../../application/ports/tasks-repository.port';

@Injectable()
export class PrismaTasksRepository implements TasksRepositoryPort {
  constructor(private readonly tenantScopedPrismaFactory: TenantScopedPrismaFactory) {}

  async findTasksByTenant(tenantId: string): Promise<DailyTask[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.dailyTask.findMany({
      where: byTenant(tenantId, { isCompleted: true }),
    });
  }

  async findCompletionsByPatientToday(patientId: string, startOfDay: Date): Promise<TaskCompletion[]> {
    const prisma = this.tenantScopedPrismaFactory.forRoot();
    return prisma.taskCompletion.findMany({
      where: {
        patientId,
        completedAt: { gte: startOfDay },
      },
    });
  }

  async findSpecificCompletionToday(
    taskId: string,
    patientId: string,
    start: Date,
    end: Date,
  ): Promise<TaskCompletion | null> {
    const prisma = this.tenantScopedPrismaFactory.forRoot();
    return prisma.taskCompletion.findFirst({
      where: {
        taskId,
        patientId,
        completedAt: { gte: start, lte: end },
      },
    });
  }

  async findById(id: string, tenantId: string): Promise<DailyTask | null> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.dailyTask.findFirst({ where: byIdAndTenant(id, tenantId) });
  }

  async findPendingTasksToday(userId: string, tenantId: string, today: Date): Promise<DailyTask[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId, userId);
    return prisma.dailyTask.findMany({
      where: {
        ...byTenant(tenantId, { patientId: userId }),
        isCompleted: false,
        dueDate: today,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPlayerStatsRanking(tenantId: string): Promise<any[]> {
    const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
    return prisma.playerStats.findMany({
      where: byTenant(tenantId),
      select: {
        currentLevel: true,
        currentXp: true,
        totalDamageDealt: true,
        patient: { select: { name: true } },
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
        completions: {
          include: { task: true },
        },
      },
    });
  }
}
