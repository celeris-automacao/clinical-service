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
exports.TenantScopedPrismaFactory = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const prisma_rls_extension_1 = require("../../../prisma/prisma-rls.extension");
let TenantScopedPrismaFactory = class TenantScopedPrismaFactory {
    constructor(prisma) {
        this.prisma = prisma;
    }
    forRoot() {
        return this.prisma;
    }
    forTenantContext(input) {
        return (0, prisma_rls_extension_1.getSecurePrisma)(this.prisma, input.userId, input.tenantId);
    }
    forTenant(tenantId, userId = 'system') {
        return this.forTenantContext({ userId, tenantId });
    }
    async runInTenantTransaction(input, callback) {
        return this.prisma.$transaction(async (tx) => {
            await (0, prisma_rls_extension_1.applyTenantRlsContext)(tx, input.userId, input.tenantId);
            return callback(tx);
        });
    }
};
exports.TenantScopedPrismaFactory = TenantScopedPrismaFactory;
exports.TenantScopedPrismaFactory = TenantScopedPrismaFactory = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantScopedPrismaFactory);
//# sourceMappingURL=tenant-scoped-prisma.factory.js.map