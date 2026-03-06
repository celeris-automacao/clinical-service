"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const common_2 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const achievements_service_1 = require("../game/achievements.service");
let TasksService = class TasksService {
    constructor(prisma, eventEmitter, achievementsService) {
        this.prisma = prisma;
        this.eventEmitter = eventEmitter;
        this.achievementsService = achievementsService;
    }
    async getDailyTasks(user) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tasks = await this.prisma.dailyTask.findMany({
            where: { tenantId: user.tenantId, isCompleted: true },
        });
        const completions = await this.prisma.taskCompletion.findMany({
            where: {
                patientId: user.userId,
                completedAt: { gte: today },
            },
        });
        return tasks.map(task => ({
            ...task,
            completed: completions.some(c => c.taskId === task.id),
        }));
    }
    async completeTask(taskId, user) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return await this.prisma.$transaction(async (tx) => {
            const alreadyCompleted = await tx.taskCompletion.findFirst({
                where: {
                    taskId: taskId,
                    patientId: user.userId,
                    completedAt: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
            });
            if (alreadyCompleted) {
                throw new common_2.BadRequestException('Você já completou esta missão hoje! Volte amanhã.');
            }
            const task = await tx.dailyTask.findUnique({ where: { id: taskId } });
            if (!task)
                throw new common_2.BadRequestException('Missão não encontrada.');
            await tx.taskCompletion.create({
                data: { taskId, patientId: user.userId, tenantId: user.tenantId },
            });
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
                    lastActivityAt: new Date()
                },
            });
            const currentBoss = await tx.bossBattle.findFirst({
                where: { tenantId: user.tenantId, isActive: true }
            });
            await tx.bossBattle.updateMany({
                where: { tenantId: user.tenantId, isActive: true },
                data: { currentHp: { decrement: task.xpReward } },
            });
            const remainingHp = currentBoss ? currentBoss.currentHp.toNumber() - task.xpReward : 1;
            const wasDefeated = remainingHp <= 0;
            if (wasDefeated && currentBoss) {
                this.eventEmitter.emit('boss.defeated', {
                    tenantId: user.tenantId,
                    bossName: currentBoss.name,
                    killerId: user.userId
                });
                await this.checkBossStatus(user.tenantId);
            }
            if (subiuDeNivel) {
                await this.achievementsService.checkLevelAchievements(user.userId, user.tenantId, novoNivel);
            }
            return {
                success: true,
                xp_earned: task.xpReward,
                current_xp: newXp,
                current_level: novoNivel,
                level_up: subiuDeNivel,
                message: subiuDeNivel
                    ? `PARABÉNS! Você subiu para o nível ${novoNivel}!`
                    : `Missão concluída! +${task.xpReward} XP`
            };
        });
    }
    async getClinicRanking(tenantId) {
        const activeBoss = await this.prisma.bossBattle.findFirst({
            where: { tenantId, isActive: true }
        });
        const taskDamage = await this.prisma.taskCompletion.findMany({
            where: { tenantId },
            include: { task: true }
        });
        const rankingMap = new Map();
        taskDamage.forEach(c => {
            const current = rankingMap.get(c.patientId) || 0;
            rankingMap.set(c.patientId, current + c.task.xpReward);
        });
        const ranking = Array.from(rankingMap.entries())
            .map(([patientId, totalDamage]) => ({
            patientId,
            totalDamage,
            bossName: activeBoss?.name || 'Nenhum Boss Ativo'
        }))
            .sort((a, b) => b.totalDamage - a.totalDamage)
            .slice(0, 10);
        return ranking;
    }
    async checkBossStatus(tenantId) {
        const activeBoss = await this.prisma.bossBattle.findFirst({
            where: { tenantId, isActive: true },
        });
        if (activeBoss && Number(activeBoss.currentHp) <= 0) {
            await this.prisma.bossBattle.update({
                where: { id: activeBoss.id },
                data: { isActive: false, currentHp: 0 },
            });
            const nextMaxHp = Number(activeBoss.maxHp) * 1.2;
            await this.prisma.bossBattle.create({
                data: {
                    tenantId: tenantId,
                    name: `Versão Evoluída de ${activeBoss.name}`,
                    maxHp: nextMaxHp,
                    currentHp: nextMaxHp,
                    isActive: true,
                },
            });
            return true;
        }
        return false;
    }
    async getCategorizedRanking(tenantId) {
        const patients = await this.prisma.patient.findMany({
            where: { tenantId },
            include: {
                clinicalRecords: true,
                completions: { include: { task: true } }
            }
        });
        return patients.map(patient => {
            const missionDamage = patient.completions.reduce((acc, ct) => acc + (ct.task?.xpReward || 0), 0);
            const clinicalDamage = patient.clinicalRecords.reduce((acc, rec) => acc + (Number(rec.weight) * 0), 0);
            return {
                name: patient.name,
                missionRank: missionDamage,
                clinicalRank: clinicalDamage,
                totalDamage: missionDamage + clinicalDamage,
                level: Math.floor(Math.sqrt((missionDamage + clinicalDamage) / 500)) + 1
            };
        }).sort((a, b) => b.totalDamage - a.totalDamage);
    }
    async getTasksToday(user) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.prisma.dailyTask.findMany({
            where: {
                patientId: user.userId,
                tenantId: user.tenantId,
                isCompleted: false,
                dueDate: today,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }
    async getRanking(user) {
        const ranking = await this.prisma.playerStats.findMany({
            where: {
                tenantId: user.tenantId
            },
            select: {
                currentLevel: true,
                currentXp: true,
                totalDamageDealt: true,
                patient: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: [
                { currentLevel: 'desc' },
                { currentXp: 'desc' },
                { totalDamageDealt: 'desc' }
            ],
            take: 10
        });
        return ranking.map((item, index) => ({
            position: index + 1,
            name: item.patient?.name || 'Herói Anônimo',
            level: item.currentLevel,
            xp: item.currentXp,
            damage: Number(item.totalDamageDealt)
        }));
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        event_emitter_1.EventEmitter2,
        achievements_service_1.AchievementsService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map