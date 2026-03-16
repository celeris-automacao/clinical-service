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
exports.TenantsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const change_tenant_status_use_case_1 = require("../../application/use-cases/change-tenant-status.use-case");
const create_tenant_use_case_1 = require("../../application/use-cases/create-tenant.use-case");
const get_tenant_by_id_use_case_1 = require("../../application/use-cases/get-tenant-by-id.use-case");
const get_tenants_use_case_1 = require("../../application/use-cases/get-tenants.use-case");
const change_tenant_status_dto_1 = require("./dto/change-tenant-status.dto");
const create_tenant_dto_1 = require("./dto/create-tenant.dto");
let TenantsController = class TenantsController {
    constructor(createTenantUseCase, getTenantsUseCase, getTenantByIdUseCase, changeTenantStatusUseCase) {
        this.createTenantUseCase = createTenantUseCase;
        this.getTenantsUseCase = getTenantsUseCase;
        this.getTenantByIdUseCase = getTenantByIdUseCase;
        this.changeTenantStatusUseCase = changeTenantStatusUseCase;
    }
    create(createTenantDto) {
        return this.createTenantUseCase.execute(createTenantDto);
    }
    findAll() {
        return this.getTenantsUseCase.execute();
    }
    findOne(id) {
        return this.getTenantByIdUseCase.execute(id);
    }
    changeStatus(id, dto) {
        return this.changeTenantStatusUseCase.execute(id, dto.status);
    }
};
exports.TenantsController = TenantsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Criar uma nova clinica (Tenant)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Clinica criada com boss inicial.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tenant_dto_1.CreateTenantDto]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar todas as clinicas cadastradas' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Buscar detalhes de uma clinica especifica' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Alterar status operacional da clinica' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, change_tenant_status_dto_1.ChangeTenantStatusDto]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "changeStatus", null);
exports.TenantsController = TenantsController = __decorate([
    (0, swagger_1.ApiTags)('Tenants'),
    (0, common_1.Controller)('tenants'),
    __metadata("design:paramtypes", [create_tenant_use_case_1.CreateTenantUseCase,
        get_tenants_use_case_1.GetTenantsUseCase,
        get_tenant_by_id_use_case_1.GetTenantByIdUseCase,
        change_tenant_status_use_case_1.ChangeTenantStatusUseCase])
], TenantsController);
//# sourceMappingURL=tenants.controller.js.map