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
const tasks_service_1 = require("./tasks.service");
const tasks_controller_1 = require("./tasks.controller");
const game_module_1 = require("../game/game.module");
const tasks_repository_1 = require("./repositories/tasks.repository");
const records_module_1 = require("../records/records.module");
const achievements_module_1 = require("../achievements/achievements.module");
let TasksModule = class TasksModule {
};
exports.TasksModule = TasksModule;
exports.TasksModule = TasksModule = __decorate([
    (0, common_1.Module)({
        imports: [
            game_module_1.GameModule,
            records_module_1.RecordsModule,
            achievements_module_1.AchievementsModule
        ],
        controllers: [tasks_controller_1.TasksController],
        providers: [
            tasks_service_1.TasksService,
            {
                provide: 'ITasksRepository',
                useClass: tasks_repository_1.TasksRepository,
            },
        ],
        exports: [tasks_service_1.TasksService, 'ITasksRepository'],
    })
], TasksModule);
//# sourceMappingURL=tasks.module.js.map