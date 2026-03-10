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
exports.TasksRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let TasksRepository = class TasksRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findTasksByTenant(tenantId) {
        return this.prisma.dailyTask.findMany({
            where: { tenantId, isCompleted: true },
        });
    }
    async findCompletionsByPatientToday(patientId, startOfDay) {
        return this.prisma.taskCompletion.findMany({
            where: {
                patientId,
                completedAt: { gte: startOfDay },
            },
        });
    }
    async findSpecificCompletionToday(taskId, patientId, start, end) {
        return this.prisma.taskCompletion.findFirst({
            where: {
                taskId,
                patientId,
                completedAt: { gte: start, lte: end },
            },
        });
    }
    async findById(id) {
        return this.prisma.dailyTask.findUnique({ where: { id } });
    }
    async findPendingTasksToday(userId, tenantId, today) {
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
    async getPlayerStatsRanking(tenantId) {
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
    async findPatientsWithActivity(tenantId) {
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
};
exports.TasksRepository = TasksRepository;
exports.TasksRepository = TasksRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TasksRepository);
//# sourceMappingURL=tasks.repository.js.map