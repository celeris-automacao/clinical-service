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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const swagger_1 = require("@nestjs/swagger");
const get_clinic_overview_use_case_1 = require("../../application/use-cases/get-clinic-overview.use-case");
const get_missing_patients_use_case_1 = require("../../application/use-cases/get-missing-patients.use-case");
const get_recent_claims_use_case_1 = require("../../application/use-cases/get-recent-claims.use-case");
let DashboardController = class DashboardController {
    constructor(getClinicOverviewUseCase, getMissingPatientsUseCase, getRecentClaimsUseCase) {
        this.getClinicOverviewUseCase = getClinicOverviewUseCase;
        this.getMissingPatientsUseCase = getMissingPatientsUseCase;
        this.getRecentClaimsUseCase = getRecentClaimsUseCase;
    }
    async getOverview(user) {
        this.checkDoctorRole(user);
        return this.getClinicOverviewUseCase.execute(user.tenantId);
    }
    async getInactive(user) {
        this.checkDoctorRole(user);
        return this.getMissingPatientsUseCase.execute(user.tenantId);
    }
    async getRecentClaims(user) {
        this.checkDoctorRole(user);
        return this.getRecentClaimsUseCase.execute(user.tenantId);
    }
    checkDoctorRole(user) {
        if (user.role !== 'admin' && user.role !== 'doctor') {
            throw new common_1.ForbiddenException('Acesso restrito a médicos e administradores.');
        }
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, swagger_1.ApiOperation)({ summary: 'Visão geral da clínica para o médico (Ranking e Atividade)' }),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('inactive-patients'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getInactive", null);
__decorate([
    (0, common_1.Get)('recent-claims'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getRecentClaims", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('dashboard'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    __metadata("design:paramtypes", [get_clinic_overview_use_case_1.GetClinicOverviewUseCase,
        get_missing_patients_use_case_1.GetMissingPatientsUseCase,
        get_recent_claims_use_case_1.GetRecentClaimsUseCase])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map