"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantsModule = void 0;
const common_1 = require("@nestjs/common");
const change_tenant_status_use_case_1 = require("./application/use-cases/change-tenant-status.use-case");
const create_tenant_use_case_1 = require("./application/use-cases/create-tenant.use-case");
const get_tenant_by_id_use_case_1 = require("./application/use-cases/get-tenant-by-id.use-case");
const get_tenants_use_case_1 = require("./application/use-cases/get-tenants.use-case");
const prisma_tenants_repository_1 = require("./infrastructure/persistence/prisma-tenants.repository");
const tenants_controller_1 = require("./presentation/http/tenants.controller");
const tenants_tokens_1 = require("./tenants.tokens");
let TenantsModule = class TenantsModule {
};
exports.TenantsModule = TenantsModule;
exports.TenantsModule = TenantsModule = __decorate([
    (0, common_1.Module)({
        controllers: [tenants_controller_1.TenantsController],
        providers: [
            create_tenant_use_case_1.CreateTenantUseCase,
            get_tenants_use_case_1.GetTenantsUseCase,
            get_tenant_by_id_use_case_1.GetTenantByIdUseCase,
            change_tenant_status_use_case_1.ChangeTenantStatusUseCase,
            {
                provide: tenants_tokens_1.TENANTS_REPOSITORY,
                useClass: prisma_tenants_repository_1.PrismaTenantsRepository,
            },
        ],
    })
], TenantsModule);
//# sourceMappingURL=tenants.module.js.map