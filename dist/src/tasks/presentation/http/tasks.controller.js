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
exports.TasksController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const complete_task_use_case_1 = require("../../application/use-cases/complete-task.use-case");
const get_categorized_ranking_use_case_1 = require("../../application/use-cases/get-categorized-ranking.use-case");
const get_daily_tasks_use_case_1 = require("../../application/use-cases/get-daily-tasks.use-case");
const get_ranking_use_case_1 = require("../../application/use-cases/get-ranking.use-case");
const get_tasks_today_use_case_1 = require("../../application/use-cases/get-tasks-today.use-case");
let TasksController = class TasksController {
    constructor(getDailyTasksUseCase, completeTaskUseCase, getRankingUseCase, getCategorizedRankingUseCase, getTasksTodayUseCase) {
        this.getDailyTasksUseCase = getDailyTasksUseCase;
        this.completeTaskUseCase = completeTaskUseCase;
        this.getRankingUseCase = getRankingUseCase;
        this.getCategorizedRankingUseCase = getCategorizedRankingUseCase;
        this.getTasksTodayUseCase = getTasksTodayUseCase;
    }
    getDailyTasks(user) {
        return this.getDailyTasksUseCase.execute(user);
    }
    completeTask(taskAssignmentId, user) {
        return this.completeTaskUseCase.execute(taskAssignmentId, user);
    }
    getRanking(user) {
        return this.getRankingUseCase.execute(user);
    }
    async getDetailedRanking(user) {
        return this.getCategorizedRankingUseCase.execute(user.tenantId);
    }
    getTasksToday(user) {
        return this.getTasksTodayUseCase.execute(user);
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "getDailyTasks", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "completeTask", null);
__decorate([
    (0, common_1.Get)('ranking'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "getRanking", null);
__decorate([
    (0, common_1.Get)('ranking/detailed'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "getDetailedRanking", null);
__decorate([
    (0, common_1.Get)('today'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "getTasksToday", null);
exports.TasksController = TasksController = __decorate([
    (0, common_1.Controller)('tasks'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    __metadata("design:paramtypes", [get_daily_tasks_use_case_1.GetDailyTasksUseCase,
        complete_task_use_case_1.CompleteTaskUseCase,
        get_ranking_use_case_1.GetRankingUseCase,
        get_categorized_ranking_use_case_1.GetCategorizedRankingUseCase,
        get_tasks_today_use_case_1.GetTasksTodayUseCase])
], TasksController);
//# sourceMappingURL=tasks.controller.js.map