"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlansModule = void 0;
const common_1 = require("@nestjs/common");
const create_plan_use_case_1 = require("./application/use-cases/create-plan.use-case");
const get_plan_by_id_use_case_1 = require("./application/use-cases/get-plan-by-id.use-case");
const get_plans_use_case_1 = require("./application/use-cases/get-plans.use-case");
const prisma_plans_repository_1 = require("./infrastructure/persistence/prisma-plans.repository");
const plans_controller_1 = require("./presentation/http/plans.controller");
const plans_tokens_1 = require("./plans.tokens");
let PlansModule = class PlansModule {
};
exports.PlansModule = PlansModule;
exports.PlansModule = PlansModule = __decorate([
    (0, common_1.Module)({
        controllers: [plans_controller_1.PlansController],
        providers: [
            create_plan_use_case_1.CreatePlanUseCase,
            get_plans_use_case_1.GetPlansUseCase,
            get_plan_by_id_use_case_1.GetPlanByIdUseCase,
            {
                provide: plans_tokens_1.PLANS_REPOSITORY,
                useClass: prisma_plans_repository_1.PrismaPlansRepository,
            },
        ],
    })
], PlansModule);
//# sourceMappingURL=plans.module.js.map