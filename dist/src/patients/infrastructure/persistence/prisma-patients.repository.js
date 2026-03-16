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
exports.PrismaPatientsRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaPatientsRepository = class PrismaPatientsRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async createWithStats(data, tenantId) {
        return this.tenantScopedPrismaFactory.runInTenantTransaction({ userId: data.supabaseId, tenantId }, async (tx) => {
            const patient = await tx.patient.create({
                data: {
                    id: data.supabaseId,
                    name: data.name,
                    tenantId,
                    gender: data.gender,
                    birthDate: data.birthDate ? new Date(data.birthDate) : null,
                },
            });
            await tx.playerStats.create({
                data: {
                    patientId: patient.id,
                    tenantId,
                    currentLevel: 1,
                },
            });
            return patient;
        });
    }
    async findBySupabaseId(id, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: id, tenantId });
        return prisma.patient.findFirst({ where: { id, tenantId } });
    }
    async findById(id, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: id, tenantId });
        return prisma.patient.findFirst({ where: { id, tenantId } });
    }
    async updateProfile(patientId, tenantId, data) {
        await this.findById(patientId, tenantId);
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId: patientId, tenantId });
        return prisma.patientProfile.upsert({
            where: { patientId },
            update: data,
            create: {
                patientId,
                ...data,
            },
        });
    }
};
exports.PrismaPatientsRepository = PrismaPatientsRepository;
exports.PrismaPatientsRepository = PrismaPatientsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaPatientsRepository);
//# sourceMappingURL=prisma-patients.repository.js.map