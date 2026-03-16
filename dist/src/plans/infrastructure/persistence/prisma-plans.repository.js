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
exports.PrismaPlansRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaPlansRepository = class PrismaPlansRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async create(data) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.plan.create({
            data: {
                ...data,
                isActive: data.isActive ?? true,
            },
        });
    }
    async findAll() {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.plan.findMany({
            where: { isActive: true },
            orderBy: { monthlyPrice: 'asc' },
        });
    }
    async findById(id) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.plan.findUnique({ where: { id } });
    }
    async findByCode(code) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.plan.findUnique({ where: { code } });
    }
};
exports.PrismaPlansRepository = PrismaPlansRepository;
exports.PrismaPlansRepository = PrismaPlansRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaPlansRepository);
//# sourceMappingURL=prisma-plans.repository.js.map