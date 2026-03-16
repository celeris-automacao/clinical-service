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
exports.PrismaSocialRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaSocialRepository = class PrismaSocialRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async findFeedByTenant(tenantId, limit = 20) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        return prisma.socialPost.findMany({
            where: { tenantId },
            include: {
                patient: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    async createPost(data) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({
            userId: data.patientId,
            tenantId: data.tenantId,
        });
        return prisma.socialPost.create({
            data,
        });
    }
};
exports.PrismaSocialRepository = PrismaSocialRepository;
exports.PrismaSocialRepository = PrismaSocialRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaSocialRepository);
//# sourceMappingURL=prisma-social.repository.js.map