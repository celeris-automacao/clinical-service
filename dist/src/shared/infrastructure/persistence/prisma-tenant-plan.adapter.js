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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaTenantPlanAdapter = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("./tenant-scoped-prisma.factory");
let PrismaTenantPlanAdapter = class PrismaTenantPlanAdapter {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async getTenantPlan(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                plan: {
                    select: {
                        id: true,
                        maxStaff: true,
                        maxPatients: true,
                    },
                },
            },
        });
        return tenant?.plan ?? null;
    }
};
exports.PrismaTenantPlanAdapter = PrismaTenantPlanAdapter;
exports.PrismaTenantPlanAdapter = PrismaTenantPlanAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaTenantPlanAdapter);
//# sourceMappingURL=prisma-tenant-plan.adapter.js.map