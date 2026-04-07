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
exports.PrismaTenantsRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaTenantsRepository = class PrismaTenantsRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async create(data) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.tenant.create({
            data: {
                name: data.name,
                legalName: data.legalName,
                cnpj: data.cnpj,
                responsibleName: data.responsibleName,
                responsibleEmail: data.responsibleEmail,
                responsiblePhone: data.responsiblePhone,
                status: 'active',
                activatedAt: new Date(),
                plan: {
                    connect: {
                        id: data.planId,
                    },
                },
                address: {
                    create: {
                        zipCode: data.address.zipCode,
                        street: data.address.street,
                        number: data.address.number,
                        complement: data.address.complement,
                        neighborhood: data.address.neighborhood,
                        city: data.address.city,
                        state: data.address.state,
                        country: data.address.country ?? 'BR',
                    },
                },
                bossBattles: {
                    create: {
                        name: 'Sedentarismo Voraz',
                        maxHp: 100000,
                        currentHp: 100000,
                        isActive: true,
                    },
                },
            },
            include: {
                plan: true,
                address: true,
            },
        });
    }
    async findByCnpj(cnpj) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.tenant.findUnique({
            where: { cnpj },
        });
    }
    async findActivePlanById(planId) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.plan.findFirst({
            where: { id: planId, isActive: true },
        });
    }
    async updateStatus(id, status) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.tenant.update({
            where: { id },
            data: {
                status,
                activatedAt: status === 'active' ? new Date() : undefined,
                deactivatedAt: status !== 'active' ? new Date() : null,
            },
            include: {
                plan: true,
                address: true,
            },
        });
    }
    async findById(id) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.tenant.findUnique({
            where: { id },
            include: {
                plan: true,
                address: true,
            },
        });
    }
    async findAll() {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.tenant.findMany({
            include: {
                plan: true,
                address: true,
                _count: {
                    select: { patients: true, staff: true },
                },
            },
        });
    }
    async updatePlan(id, planId) {
        const prisma = this.tenantScopedPrismaFactory.forRoot();
        return prisma.tenant.update({
            where: { id },
            data: { planId },
        });
    }
};
exports.PrismaTenantsRepository = PrismaTenantsRepository;
exports.PrismaTenantsRepository = PrismaTenantsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaTenantsRepository);
//# sourceMappingURL=prisma-tenants.repository.js.map