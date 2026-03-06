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
exports.RewardsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const records_service_1 = require("../records/records.service");
const event_emitter_1 = require("@nestjs/event-emitter");
let RewardsService = class RewardsService {
    constructor(prisma, recordsService, eventEmitter) {
        this.prisma = prisma;
        this.recordsService = recordsService;
        this.eventEmitter = eventEmitter;
    }
    async getAvailableRewards(user) {
        const stats = await this.recordsService.getStats(user);
        const rewards = await this.prisma.reward.findMany({
            where: { tenantId: user.tenantId, isActive: true },
        });
        const claims = await this.prisma.rewardClaim.findMany({
            where: { patientId: user.userId },
        });
        return rewards.map(reward => ({
            ...reward,
            unlocked: stats.totalDamage >= reward.requiredDamage,
            claimed: claims.some(c => c.rewardId === reward.id),
            progress: Math.min(100, (stats.totalDamage / reward.requiredDamage) * 100)
        }));
    }
    async claimReward(rewardId, user) {
        const reward = await this.prisma.reward.findUnique({
            where: { id: rewardId }
        });
        if (!reward) {
            throw new common_1.BadRequestException('Recompensa não encontrada. Verifique o ID enviado.');
        }
        const alreadyClaimed = await this.prisma.rewardClaim.findFirst({
            where: { rewardId, patientId: user.userId }
        });
        if (alreadyClaimed) {
            throw new common_1.BadRequestException('Você já resgatou esta recompensa!');
        }
        const stats = await this.recordsService.getStats(user);
        if (stats.totalDamage < reward.requiredDamage) {
            throw new common_1.BadRequestException(`Dano insuficiente. Você tem ${stats.totalDamage} e precisa de ${reward.requiredDamage}.`);
        }
        const claim = await this.prisma.rewardClaim.create({
            data: {
                rewardId,
                patientId: user.userId,
                tenantId: user.tenantId,
            },
        });
        this.eventEmitter.emit('achievement.unlocked', {
            patientId: user.userId,
            tenantId: user.tenantId,
            achievement: reward.title
        });
        return claim;
    }
};
exports.RewardsService = RewardsService;
exports.RewardsService = RewardsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        records_service_1.RecordsService,
        event_emitter_1.EventEmitter2])
], RewardsService);
//# sourceMappingURL=rewards.service.js.map