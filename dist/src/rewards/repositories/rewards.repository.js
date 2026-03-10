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
exports.RewardsRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let RewardsRepository = class RewardsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllActiveByTenant(tenantId) {
        return this.prisma.reward.findMany({
            where: { tenantId, isActive: true },
        });
    }
    async findClaimsByPatient(patientId) {
        return this.prisma.rewardClaim.findMany({
            where: { patientId },
        });
    }
    async findById(rewardId) {
        return this.prisma.reward.findUnique({
            where: { id: rewardId },
        });
    }
    async findSpecificClaim(rewardId, patientId) {
        return this.prisma.rewardClaim.findFirst({
            where: { rewardId, patientId },
        });
    }
    async createClaim(data) {
        return this.prisma.rewardClaim.create({ data });
    }
};
exports.RewardsRepository = RewardsRepository;
exports.RewardsRepository = RewardsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RewardsRepository);
//# sourceMappingURL=rewards.repository.js.map