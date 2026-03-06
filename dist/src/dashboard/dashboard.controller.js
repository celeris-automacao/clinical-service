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
const dashboard_service_1 = require("./dashboard.service");
const supabase_guard_1 = require("../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../common/decorators/get-user.decorator");
const common_2 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const swagger_1 = require("@nestjs/swagger");
let DashboardController = class DashboardController {
    constructor(prisma, dashboardService) {
        this.prisma = prisma;
        this.dashboardService = dashboardService;
    }
    async getOverview(user) {
        this.checkDoctorRole(user);
        return this.dashboardService.getClinicOverview(user.tenantId);
    }
    async getInactive(user) {
        if (user.role !== 'admin' && user.role !== 'doctor') {
            throw new common_2.ForbiddenException('Acesso restrito a médicos e administradores.');
        }
        return this.dashboardService.getMissingPatients(user.tenantId);
    }
    async getRecentClaims(user) {
        if (user.role !== 'admin' && user.role !== 'doctor') {
            throw new common_2.ForbiddenException('Acesso restrito.');
        }
        return this.prisma.rewardClaim.findMany({
            where: { tenantId: user.tenantId },
            include: { reward: true },
            orderBy: { claimedAt: 'desc' },
            take: 10
        });
    }
    checkDoctorRole(user) {
        if (user.role !== 'admin' && user.role !== 'doctor') {
            throw new common_2.ForbiddenException('Acesso restrito a médicos e administradores.');
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
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getRecentClaims", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('v1/dashboard'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map