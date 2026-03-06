// src/tasks/repositories/tasks.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ITasksRepository } from './interfaces/tasks.repository.interface';
import { DailyTask, TaskCompletion } from '@prisma/client';

@Injectable()
export class TasksRepository implements ITasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTasksByTenant(tenantId: string): Promise<DailyTask[]> {
    return this.prisma.dailyTask.findMany({
      where: { tenantId, isCompleted: true },
    });
  }

  async findCompletionsByPatientToday(patientId: string, startOfDay: Date): Promise<TaskCompletion[]> {
    return this.prisma.taskCompletion.findMany({
      where: {
        patientId,
        completedAt: { gte: startOfDay },
      },
    });
  }

  async findSpecificCompletionToday(taskId: string, patientId: string, start: Date, end: Date): Promise<TaskCompletion | null> {
    return this.prisma.taskCompletion.findFirst({
      where: {
        taskId,
        patientId,
        completedAt: { gte: start, lte: end },
      },
    });
  }

  async findById(id: string): Promise<DailyTask | null> {
    return this.prisma.dailyTask.findUnique({ where: { id } });
  }

  async findPendingTasksToday(userId: string, tenantId: string, today: Date): Promise<DailyTask[]> {
    return this.prisma.dailyTask.findMany({
      where: {
        patientId: userId,
        tenantId: tenantId,
        isCompleted: false,
        dueDate: today,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPlayerStatsRanking(tenantId: string): Promise<any[]> {
    return this.prisma.playerStats.findMany({
      where: { tenantId },
      select: {
        currentLevel: true,
        currentXp: true,
        totalDamageDealt: true,
        patient: { select: { name: true } }
      },
      orderBy: [
        { currentLevel: 'desc' },
        { currentXp: 'desc' },
        { totalDamageDealt: 'desc' }
      ],
    });
  }

  async findPatientsWithActivity(tenantId: string): Promise<any[]> {
    return this.prisma.patient.findMany({
      where: { tenantId },
      include: {
        clinicalRecords: true,
        completions: { 
          include: { task: true } 
        }
      }
    });
  }
}