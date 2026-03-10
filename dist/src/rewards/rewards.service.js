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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardsService = void 0;
const common_1 = require("@nestjs/common");
const records_service_1 = require("../records/records.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../prisma/prisma.service");
const achievements_service_1 = require("../achievements/achievements.service");
let RewardsService = class RewardsService {
    constructor(repository, recordsService, eventEmitter, prisma, achievementsService) {
        this.repository = repository;
        this.recordsService = recordsService;
        this.eventEmitter = eventEmitter;
        this.prisma = prisma;
        this.achievementsService = achievementsService;
    }
    async getAvailableRewards(user) {
        const stats = await this.recordsService.getStats(user);
        const [rewards, claims] = await Promise.all([
            this.repository.findAllActiveByTenant(user.tenantId),
            this.repository.findClaimsByPatient(user.userId),
        ]);
        return rewards.map(reward => ({
            ...reward,
            unlocked: stats.totalDamage >= reward.requiredDamage,
            claimed: claims.some(c => c.rewardId === reward.id),
            progress: Math.min(100, (stats.totalDamage / reward.requiredDamage) * 100)
        }));
    }
    async claimReward(rewardId, user) {
        const reward = await this.repository.findById(rewardId);
        if (!reward)
            throw new common_1.BadRequestException('Recompensa não encontrada.');
        const alreadyClaimed = await this.repository.findSpecificClaim(rewardId, user.userId);
        if (alreadyClaimed)
            throw new common_1.BadRequestException('Você já resgatou esta recompensa!');
        return await this.prisma.$transaction(async (tx) => {
            const stats = await tx.playerStats.findUnique({
                where: { patientId: user.userId }
            });
            if (!stats)
                throw new common_1.BadRequestException('Perfil do jogador não encontrado.');
            const currentGold = Number(stats.currentGold);
            const totalDamage = Number(stats.totalDamageDealt);
            if (totalDamage < reward.requiredDamage) {
                throw new common_1.BadRequestException('Dano total insuficiente para desbloquear.');
            }
            if (currentGold < reward.goldCost) {
                throw new common_1.BadRequestException(`Saldo insuficiente. Você tem ${currentGold} moedas.`);
            }
            await tx.playerStats.update({
                where: { patientId: user.userId },
                data: { currentGold: { decrement: reward.goldCost } }
            });
            await this.repository.createClaim({
                rewardId,
                patientId: user.userId,
                tenantId: user.tenantId,
            });
            this.eventEmitter.emit('achievement.unlocked', {
                userId: user.userId,
                tenantId: user.tenantId,
                achievement: reward.title,
            });
            return {
                success: true,
                remainingGold: currentGold - reward.goldCost
            };
        });
    }
};
exports.RewardsService = RewardsService;
exports.RewardsService = RewardsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('IRewardsRepository')),
    __param(4, (0, common_1.Inject)((0, common_1.forwardRef)(() => achievements_service_1.AchievementsService))),
    __metadata("design:paramtypes", [Object, records_service_1.RecordsService,
        event_emitter_1.EventEmitter2,
        prisma_service_1.PrismaService,
        achievements_service_1.AchievementsService])
], RewardsService);
//# sourceMappingURL=rewards.service.js.map