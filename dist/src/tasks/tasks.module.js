"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksModule = void 0;
const common_1 = require("@nestjs/common");
const achievements_module_1 = require("../achievements/achievements.module");
const records_module_1 = require("../records/records.module");
const assign_task_template_use_case_1 = require("./application/use-cases/assign-task-template.use-case");
const bulk_assign_task_template_use_case_1 = require("./application/use-cases/bulk-assign-task-template.use-case");
const complete_task_use_case_1 = require("./application/use-cases/complete-task.use-case");
const create_task_template_use_case_1 = require("./application/use-cases/create-task-template.use-case");
const get_categorized_ranking_use_case_1 = require("./application/use-cases/get-categorized-ranking.use-case");
const get_daily_tasks_use_case_1 = require("./application/use-cases/get-daily-tasks.use-case");
const get_ranking_use_case_1 = require("./application/use-cases/get-ranking.use-case");
const get_tasks_today_use_case_1 = require("./application/use-cases/get-tasks-today.use-case");
const list_task_templates_use_case_1 = require("./application/use-cases/list-task-templates.use-case");
const tasks_achievements_adapter_1 = require("./infrastructure/adapters/tasks-achievements.adapter");
const prisma_task_completion_transaction_adapter_1 = require("./infrastructure/persistence/prisma-task-completion-transaction.adapter");
const prisma_tasks_repository_1 = require("./infrastructure/persistence/prisma-tasks.repository");
const task_assignments_controller_1 = require("./presentation/http/task-assignments.controller");
const task_templates_controller_1 = require("./presentation/http/task-templates.controller");
const tasks_controller_1 = require("./presentation/http/tasks.controller");
const tasks_tokens_1 = require("./tasks.tokens");
let TasksModule = class TasksModule {
};
exports.TasksModule = TasksModule;
exports.TasksModule = TasksModule = __decorate([
    (0, common_1.Module)({
        imports: [records_module_1.RecordsModule, achievements_module_1.AchievementsModule],
        controllers: [tasks_controller_1.TasksController, task_templates_controller_1.TaskTemplatesController, task_assignments_controller_1.TaskAssignmentsController],
        providers: [
            create_task_template_use_case_1.CreateTaskTemplateUseCase,
            list_task_templates_use_case_1.ListTaskTemplatesUseCase,
            assign_task_template_use_case_1.AssignTaskTemplateUseCase,
            bulk_assign_task_template_use_case_1.BulkAssignTaskTemplateUseCase,
            complete_task_use_case_1.CompleteTaskUseCase,
            get_categorized_ranking_use_case_1.GetCategorizedRankingUseCase,
            get_daily_tasks_use_case_1.GetDailyTasksUseCase,
            get_ranking_use_case_1.GetRankingUseCase,
            get_tasks_today_use_case_1.GetTasksTodayUseCase,
            {
                provide: tasks_tokens_1.TASKS_REPOSITORY,
                useClass: prisma_tasks_repository_1.PrismaTasksRepository,
            },
            {
                provide: tasks_tokens_1.TASK_COMPLETION_TRANSACTION_PORT,
                useClass: prisma_task_completion_transaction_adapter_1.PrismaTaskCompletionTransactionAdapter,
            },
            {
                provide: tasks_tokens_1.TASKS_ACHIEVEMENTS_PORT,
                useClass: tasks_achievements_adapter_1.TasksAchievementsAdapter,
            },
        ],
        exports: [tasks_tokens_1.TASKS_REPOSITORY],
    })
], TasksModule);
//# sourceMappingURL=tasks.module.js.map