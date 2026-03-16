"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_dashboard_repository_1 = require("./infrastructure/persistence/prisma-dashboard.repository");
const prisma_notifications_repository_1 = require("./infrastructure/persistence/prisma-notifications.repository");
const get_clinic_overview_use_case_1 = require("./application/use-cases/get-clinic-overview.use-case");
const get_missing_patients_use_case_1 = require("./application/use-cases/get-missing-patients.use-case");
const get_recent_claims_use_case_1 = require("./application/use-cases/get-recent-claims.use-case");
const dashboard_controller_1 = require("./presentation/http/dashboard.controller");
const notifications_service_1 = require("./presentation/listeners/notifications.service");
const dashboard_tokens_1 = require("./dashboard.tokens");
let DashboardModule = class DashboardModule {
};
exports.DashboardModule = DashboardModule;
exports.DashboardModule = DashboardModule = __decorate([
    (0, common_1.Module)({
        controllers: [dashboard_controller_1.DashboardController],
        providers: [
            get_clinic_overview_use_case_1.GetClinicOverviewUseCase,
            get_missing_patients_use_case_1.GetMissingPatientsUseCase,
            get_recent_claims_use_case_1.GetRecentClaimsUseCase,
            notifications_service_1.NotificationsService,
            {
                provide: dashboard_tokens_1.DASHBOARD_REPOSITORY,
                useClass: prisma_dashboard_repository_1.PrismaDashboardRepository,
            },
            {
                provide: dashboard_tokens_1.NOTIFICATIONS_REPOSITORY,
                useClass: prisma_notifications_repository_1.PrismaNotificationsRepository,
            },
        ],
    })
], DashboardModule);
//# sourceMappingURL=dashboard.module.js.map