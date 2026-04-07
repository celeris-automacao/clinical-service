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
exports.PlansController = void 0;
const common_1 = require("@nestjs/common");
const create_plan_use_case_1 = require("../../application/use-cases/create-plan.use-case");
const get_plan_by_id_use_case_1 = require("../../application/use-cases/get-plan-by-id.use-case");
const get_plans_use_case_1 = require("../../application/use-cases/get-plans.use-case");
const request_plan_upgrade_use_case_1 = require("../../application/use-cases/request-plan-upgrade.use-case");
const get_pending_upgrade_request_use_case_1 = require("../../application/use-cases/get-pending-upgrade-request.use-case");
const get_upgrade_requests_use_case_1 = require("../../application/use-cases/get-upgrade-requests.use-case");
const resolve_upgrade_request_use_case_1 = require("../../application/use-cases/resolve-upgrade-request.use-case");
const create_plan_dto_1 = require("./dto/create-plan.dto");
const create_upgrade_request_dto_1 = require("./dto/create-upgrade-request.dto");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
let PlansController = class PlansController {
    constructor(createPlanUseCase, getPlansUseCase, getPlanByIdUseCase, requestPlanUpgradeUseCase, getPendingUpgradeRequestUseCase, getUpgradeRequestsUseCase, resolveUpgradeRequestUseCase) {
        this.createPlanUseCase = createPlanUseCase;
        this.getPlansUseCase = getPlansUseCase;
        this.getPlanByIdUseCase = getPlanByIdUseCase;
        this.requestPlanUpgradeUseCase = requestPlanUpgradeUseCase;
        this.getPendingUpgradeRequestUseCase = getPendingUpgradeRequestUseCase;
        this.getUpgradeRequestsUseCase = getUpgradeRequestsUseCase;
        this.resolveUpgradeRequestUseCase = resolveUpgradeRequestUseCase;
    }
    create(dto) {
        return this.createPlanUseCase.execute(dto);
    }
    findAll() {
        return this.getPlansUseCase.execute();
    }
    findOne(id) {
        return this.getPlanByIdUseCase.execute(id);
    }
    getPendingRequest(user) {
        return this.getPendingUpgradeRequestUseCase.execute(user.tenantId);
    }
    async requestUpgrade(user, dto) {
        return this.requestPlanUpgradeUseCase.execute(user.tenantId, dto.targetPlanId);
    }
    getUpgradeRequests(status) {
        return this.getUpgradeRequestsUseCase.execute(status);
    }
    resolveUpgradeRequest(id, action, user) {
        return this.resolveUpgradeRequestUseCase.execute(id, action, user.userId);
    }
};
exports.PlansController = PlansController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('superadmin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_plan_dto_1.CreatePlanDto]),
    __metadata("design:returntype", void 0)
], PlansController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlansController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlansController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('upgrade-request/pending'),
    (0, roles_decorator_1.Roles)('clinic_owner'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PlansController.prototype, "getPendingRequest", null);
__decorate([
    (0, common_1.Post)('upgrade-request'),
    (0, roles_decorator_1.Roles)('clinic_owner'),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_upgrade_request_dto_1.CreateUpgradeRequestDto]),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "requestUpgrade", null);
__decorate([
    (0, common_1.Get)('admin/upgrade-requests'),
    (0, roles_decorator_1.Roles)('superadmin'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlansController.prototype, "getUpgradeRequests", null);
__decorate([
    (0, common_1.Patch)('admin/upgrade-requests/:id/:action'),
    (0, roles_decorator_1.Roles)('superadmin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('action')),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PlansController.prototype, "resolveUpgradeRequest", null);
exports.PlansController = PlansController = __decorate([
    (0, common_1.Controller)('plans'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [create_plan_use_case_1.CreatePlanUseCase,
        get_plans_use_case_1.GetPlansUseCase,
        get_plan_by_id_use_case_1.GetPlanByIdUseCase,
        request_plan_upgrade_use_case_1.RequestPlanUpgradeUseCase,
        get_pending_upgrade_request_use_case_1.GetPendingUpgradeRequestUseCase,
        get_upgrade_requests_use_case_1.GetUpgradeRequestsUseCase,
        resolve_upgrade_request_use_case_1.ResolveUpgradeRequestUseCase])
], PlansController);
//# sourceMappingURL=plans.controller.js.map