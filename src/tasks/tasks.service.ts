// src/tasks/tasks.service.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ITasksRepository } from './repositories/interfaces/tasks.repository.interface';
import { IRecordsRepository } from '../records/repositories/interfaces/records.repository.interface'; // Nova importação
import { PrismaService } from '../prisma/prisma.service';
import { UserContext } from '../common/decorators/get-user.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AchievementsService } from '../achievements/achievements.service';
import { RecordsService } from '../records/records.service';

@Injectable()
export class TasksService {
  constructor(
    @Inject('ITasksRepository') private readonly repository: ITasksRepository,
    @Inject('IRecordsRepository') private readonly recordsRepository: IRecordsRepository, // Nova dependência
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly achievementsService: AchievementsService,
    private readonly recordsService: RecordsService,
  ) { }

  async getDailyTasks(user: UserContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [tasks, completions] = await Promise.all([
      this.repository.findTasksByTenant(user.tenantId),
      this.repository.findCompletionsByPatientToday(user.userId, today),
    ]);

    return tasks.map(task => ({
      ...task,
      completed: completions.some(c => c.taskId === task.id),
    }));
  }

  async completeTask(taskId: string, user: UserContext) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Anti-Cheat via Repository
      const alreadyCompleted = await this.repository.findSpecificCompletionToday(
        taskId, user.userId, startOfDay, endOfDay
      );

      if (alreadyCompleted) {
        throw new BadRequestException('Você já completou esta missão hoje!');
      }

      const task = await this.repository.findById(taskId);
      if (!task) throw new BadRequestException('Missão não encontrada.');

      // 2. Registro da Conclusão
      await tx.taskCompletion.create({
        data: { taskId, patientId: user.userId, tenantId: user.tenantId },
      });

      // 3. Evolução do Jogador
      const stats = await tx.playerStats.upsert({
        where: { patientId: user.userId },
        update: {},
        create: {
          patientId: user.userId,
          tenantId: user.tenantId,
          currentXp: 0,
          currentLevel: 1
        },
      });

      const newXp = stats.currentXp + task.xpReward;
      const xpParaProximoNivel = stats.currentLevel * 1000;
      let novoNivel = stats.currentLevel;
      let subiuDeNivel = false;

      if (newXp >= xpParaProximoNivel) {
        novoNivel += 1;
        subiuDeNivel = true;
      }

      await tx.playerStats.update({
        where: { patientId: user.userId },
        data: {
          currentXp: newXp,
          currentLevel: novoNivel,
          totalDamageDealt: { increment: task.xpReward },
          // NOVIDADE: Adicionando Gold spendável igual ao XP/Dano ganho
          currentGold: { increment: task.xpReward },
          lastActivityAt: new Date()
        },
      });

      // 4. Dano ao Boss e Eventos
      const damageResult = await this.checkAndApplyBossDamage(tx, user.tenantId, task.xpReward);

      if (subiuDeNivel) {
        await this.achievementsService.checkLevelAchievements(user.userId, user.tenantId, novoNivel);
      }

      this.eventEmitter.emit('task.completed', { taskId, userId: user.userId, xp: task.xpReward });

      return {
        success: true,
        xp_earned: task.xpReward,
        current_xp: newXp,
        current_level: novoNivel,
        level_up: subiuDeNivel,
        boss_damage: damageResult // <--- CRÍTICO PARA O TESTE PASSAR
      };
    });
  }

  async getCategorizedRanking(tenantId: string) {

    const [patients, clinicalDamageMap] = await Promise.all([
      this.repository.findPatientsWithActivity(tenantId),
      this.recordsRepository.getClinicalDamageByTenant(tenantId),
    ]);

    return patients.map(patient => {
      // 2. Dano vindo de missões
      const missionDamage = patient.completions.reduce(
        (acc, ct) => acc + (ct.task?.xpReward || 0), 0
      );
      const clinicalDamage = clinicalDamageMap.get(patient.id) || 0;
      const totalDamage = missionDamage + clinicalDamage;

      return {
        name: patient.name,
        missionRank: missionDamage,
        clinicalRank: clinicalDamage,
        totalDamage: totalDamage,
        // 4. Nível baseado no esforço total (Missões + Saúde)
        level: Math.floor(Math.sqrt(totalDamage / 500)) + 1
      };
    }).sort((a, b) => b.totalDamage - a.totalDamage);
  }

  private async checkAndApplyBossDamage(tx: any, tenantId: string, damage: number) {
    const activeBoss = await tx.bossBattle.findFirst({
      where: { tenantId, isActive: true }
    });

    if (!activeBoss) return 0;

    const newHp = Number(activeBoss.currentHp) - damage;

    if (newHp <= 0) {
      // Se a missão matou o Boss, dispara a lógica de vitória e renascimento
      await this.recordsService.handleBossVictory(activeBoss.id, tenantId);
    } else {
      // Dano normal
      await tx.bossBattle.update({
        where: { id: activeBoss.id },
        data: { currentHp: newHp }
      });
    }

    return damage;
  }

  async getRanking(user: UserContext) {
    const ranking = await this.repository.getPlayerStatsRanking(user.tenantId);
    return ranking.map((item, index) => ({
      position: index + 1,
      name: item.patient?.name || 'Herói Anônimo',
      level: item.currentLevel,
      xp: item.currentXp,
      damage: Number(item.totalDamageDealt)
    }));
  }

  async getTasksToday(user: UserContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.repository.findPendingTasksToday(user.userId, user.tenantId, today);
  }
}