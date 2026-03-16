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
const records_module_1 = require("./records/records.module");
const tasks_module_1 = require("./tasks/tasks.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const game_module_1 = require("./game/game.module");
const auth_module_1 = require("./auth/auth.module");
const social_module_1 = require("./social/social.module");
const tenants_module_1 = require("./tenants/tenants.module");
const patients_module_1 = require("./patients/patients.module");
const plans_module_1 = require("./plans/plans.module");
const rewards_module_1 = require("./rewards/rewards.module");
const shared_infrastructure_module_1 = require("./shared/infrastructure/shared-infrastructure.module");
const staff_module_1 = require("./staff/staff.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            shared_infrastructure_module_1.SharedInfrastructureModule,
            auth_module_1.AuthModule,
            records_module_1.RecordsModule,
            tasks_module_1.TasksModule,
            dashboard_module_1.DashboardModule,
            game_module_1.GameModule,
            social_module_1.SocialModule,
            tenants_module_1.TenantsModule,
            patients_module_1.PatientsModule,
            plans_module_1.PlansModule,
            rewards_module_1.RewardsModule,
            staff_module_1.StaffModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map