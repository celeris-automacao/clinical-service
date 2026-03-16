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
exports.PrismaRecordsRepository = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaRecordsRepository = class PrismaRecordsRepository {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async create(data, userId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenantContext({ userId, tenantId });
        return prisma.clinicalRecord.create({
            data: {
                weight: data.weight,
                skeletalMuscleMass: data.skeletalMuscleMass,
                bodyFatMass: data.bodyFatMass,
                patientId: userId,
                tenantId,
            },
        });
    }
    async findAllByPatient(patientId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId, patientId);
        return prisma.clinicalRecord.findMany({
            where: { patientId, tenantId },
            orderBy: { recordedAt: 'asc' },
        });
    }
    async findLastTwo(patientId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId, patientId);
        return prisma.clinicalRecord.findMany({
            where: { patientId, tenantId },
            orderBy: { recordedAt: 'desc' },
            take: 2,
        });
    }
    async getClinicalDamageByTenant(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        const allRecords = await prisma.clinicalRecord.findMany({
            where: { tenantId },
            select: { patientId: true, weight: true, recordedAt: true },
            orderBy: { recordedAt: 'asc' },
        });
        const damageMap = new Map();
        const patientGroups = allRecords.reduce((groups, record) => {
            if (!groups[record.patientId]) {
                groups[record.patientId] = [];
            }
            groups[record.patientId].push(record);
            return groups;
        }, {});
        Object.entries(patientGroups).forEach(([patientId, records]) => {
            let totalLoss = 0;
            for (let i = 1; i < records.length; i += 1) {
                const diff = Number(records[i - 1].weight) - Number(records[i].weight);
                if (diff > 0) {
                    totalLoss += diff;
                }
            }
            damageMap.set(patientId, Math.round(totalLoss * 7700));
        });
        return damageMap;
    }
};
exports.PrismaRecordsRepository = PrismaRecordsRepository;
exports.PrismaRecordsRepository = PrismaRecordsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaRecordsRepository);
//# sourceMappingURL=prisma-records.repository.js.map