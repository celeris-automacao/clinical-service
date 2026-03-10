"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("./prisma/prisma.module");
const records_module_1 = require("./records/records.module");
const tasks_module_1 = require("./tasks/tasks.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const game_module_1 = require("./game/game.module");
const event_emitter_1 = require("@nestjs/event-emitter");
const auth_module_1 = require("./auth/auth.module");
const social_module_1 = require("./social/social.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            event_emitter_1.EventEmitterModule.forRoot(),
            prisma_module_1.PrismaModule,
            records_module_1.RecordsModule,
            tasks_module_1.TasksModule,
            dashboard_module_1.DashboardModule,
            game_module_1.GameModule,
            social_module_1.SocialModule
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map