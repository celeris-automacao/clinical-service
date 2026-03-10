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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const achievements_service_1 = require("../achievements/achievements.service");
const records_service_1 = require("../records/records.service");
let TasksService = class TasksService {
    constructor(repository, recordsRepository, prisma, eventEmitter, achievementsService, recordsService) {
        this.repository = repository;
        this.recordsRepository = recordsRepository;
        this.prisma = prisma;
        this.eventEmitter = eventEmitter;
        this.achievementsService = achievementsService;
        this.recordsService = recordsService;
    }
    async getDailyTasks(user) {
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
    async completeTask(taskId, user) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return await this.prisma.$transaction(async (tx) => {
            const alreadyCompleted = await this.repository.findSpecificCompletionToday(taskId, user.userId, startOfDay, endOfDay);
            if (alreadyCompleted) {
                throw new common_1.BadRequestException('Você já completou esta missão hoje!');
            }
            const task = await this.repository.findById(taskId);
            if (!task)
                throw new common_1.BadRequestException('Missão não encontrada.');
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
                    currentGold: { increment: task.xpReward },
                    lastActivityAt: new Date()
                },
            });
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
                boss_damage: damageResult
            };
        });
    }
    async getCategorizedRanking(tenantId) {
        const [patients, clinicalDamageMap] = await Promise.all([
            this.repository.findPatientsWithActivity(tenantId),
            this.recordsRepository.getClinicalDamageByTenant(tenantId),
        ]);
        return patients.map(patient => {
            const missionDamage = patient.completions.reduce((acc, ct) => acc + (ct.task?.xpReward || 0), 0);
            const clinicalDamage = clinicalDamageMap.get(patient.id) || 0;
            const totalDamage = missionDamage + clinicalDamage;
            return {
                name: patient.name,
                missionRank: missionDamage,
                clinicalRank: clinicalDamage,
                totalDamage: totalDamage,
                level: Math.floor(Math.sqrt(totalDamage / 500)) + 1
            };
        }).sort((a, b) => b.totalDamage - a.totalDamage);
    }
    async checkAndApplyBossDamage(tx, tenantId, damage) {
        const activeBoss = await tx.bossBattle.findFirst({
            where: { tenantId, isActive: true }
        });
        if (!activeBoss)
            return 0;
        const newHp = Number(activeBoss.currentHp) - damage;
        if (newHp <= 0) {
            await this.recordsService.handleBossVictory(activeBoss.id, tenantId);
        }
        else {
            await tx.bossBattle.update({
                where: { id: activeBoss.id },
                data: { currentHp: newHp }
            });
        }
        return damage;
    }
    async getRanking(user) {
        const ranking = await this.repository.getPlayerStatsRanking(user.tenantId);
        return ranking.map((item, index) => ({
            position: index + 1,
            name: item.patient?.name || 'Herói Anônimo',
            level: item.currentLevel,
            xp: item.currentXp,
            damage: Number(item.totalDamageDealt)
        }));
    }
    async getTasksToday(user) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.repository.findPendingTasksToday(user.userId, user.tenantId, today);
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('ITasksRepository')),
    __param(1, (0, common_1.Inject)('IRecordsRepository')),
    __param(4, (0, common_1.Inject)((0, common_1.forwardRef)(() => achievements_service_1.AchievementsService))),
    __param(5, (0, common_1.Inject)((0, common_1.forwardRef)(() => records_service_1.RecordsService))),
    __metadata("design:paramtypes", [Object, Object, prisma_service_1.PrismaService,
        event_emitter_1.EventEmitter2,
        achievements_service_1.AchievementsService,
        records_service_1.RecordsService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map