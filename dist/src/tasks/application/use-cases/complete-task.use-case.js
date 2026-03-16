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
exports.CompleteTaskUseCase = void 0;
const common_1 = require("@nestjs/common");
const application_events_1 = require("../../../shared/application/events/application-events");
const shared_tokens_1 = require("../../../shared/shared.tokens");
const handle_boss_victory_use_case_1 = require("../../../records/application/use-cases/handle-boss-victory.use-case");
const tasks_tokens_1 = require("../../tasks.tokens");
let CompleteTaskUseCase = class CompleteTaskUseCase {
    constructor(repository, taskCompletionTransactionPort, eventBus, tasksAchievementsPort, handleBossVictoryUseCase) {
        this.repository = repository;
        this.taskCompletionTransactionPort = taskCompletionTransactionPort;
        this.eventBus = eventBus;
        this.tasksAchievementsPort = tasksAchievementsPort;
        this.handleBossVictoryUseCase = handleBossVictoryUseCase;
    }
    async execute(taskAssignmentId, user) {
        const assignment = await this.repository.findAssignmentById(taskAssignmentId, user.tenantId);
        if (!assignment || assignment.patientId !== user.userId) {
            throw new common_1.BadRequestException('Missao nao encontrada.');
        }
        if (assignment.status === 'completed') {
            throw new common_1.BadRequestException('Voce ja completou esta missao.');
        }
        if (assignment.status !== 'pending') {
            throw new common_1.BadRequestException('A missao nao esta disponivel para conclusao.');
        }
        const result = await this.taskCompletionTransactionPort.execute({
            assignmentId: taskAssignmentId,
            patientId: user.userId,
            tenantId: user.tenantId,
            xpReward: assignment.template.xpReward,
        });
        if (result.defeatedBossId) {
            await this.handleBossVictoryUseCase.execute(result.defeatedBossId, user.tenantId, user.userId);
        }
        if (result.leveledUp) {
            await this.tasksAchievementsPort.checkLevelAchievements({
                patientId: user.userId,
                tenantId: user.tenantId,
                newLevel: result.newLevel,
            });
        }
        this.eventBus.publish((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.taskCompleted, {
            taskId: taskAssignmentId,
            userId: user.userId,
            tenantId: user.tenantId,
            xp: assignment.template.xpReward,
        }));
        return {
            success: true,
            xp_earned: assignment.template.xpReward,
            current_xp: result.newXp,
            current_level: result.newLevel,
            level_up: result.leveledUp,
            boss_damage: result.bossDamage,
        };
    }
};
exports.CompleteTaskUseCase = CompleteTaskUseCase;
exports.CompleteTaskUseCase = CompleteTaskUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(tasks_tokens_1.TASKS_REPOSITORY)),
    __param(1, (0, common_1.Inject)(tasks_tokens_1.TASK_COMPLETION_TRANSACTION_PORT)),
    __param(2, (0, common_1.Inject)(shared_tokens_1.APPLICATION_EVENT_BUS)),
    __param(3, (0, common_1.Inject)(tasks_tokens_1.TASKS_ACHIEVEMENTS_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, handle_boss_victory_use_case_1.HandleBossVictoryUseCase])
], CompleteTaskUseCase);
//# sourceMappingURL=complete-task.use-case.js.map