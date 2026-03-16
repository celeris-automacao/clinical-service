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
exports.PrismaRewardClaimTransactionAdapter = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaRewardClaimTransactionAdapter = class PrismaRewardClaimTransactionAdapter {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async claimReward(input) {
        return this.tenantScopedPrismaFactory.runInTenantTransaction({ userId: input.patientId, tenantId: input.tenantId }, async (tx) => {
            const stats = await tx.playerStats.findUnique({
                where: { patientId: input.patientId },
            });
            if (!stats) {
                throw new common_1.BadRequestException('Perfil do jogador nao encontrado.');
            }
            const currentGold = Number(stats.currentGold);
            const totalDamage = Number(stats.totalDamageDealt);
            if (totalDamage < input.requiredDamage) {
                throw new common_1.BadRequestException('Dano total insuficiente para desbloquear.');
            }
            if (currentGold < input.goldCost) {
                throw new common_1.BadRequestException(`Saldo insuficiente. Voce tem ${currentGold} moedas.`);
            }
            await tx.playerStats.update({
                where: { patientId: input.patientId },
                data: { currentGold: { decrement: input.goldCost } },
            });
            await tx.rewardClaim.create({
                data: {
                    rewardId: input.rewardId,
                    patientId: input.patientId,
                    tenantId: input.tenantId,
                },
            });
            return {
                remainingGold: currentGold - input.goldCost,
            };
        });
    }
};
exports.PrismaRewardClaimTransactionAdapter = PrismaRewardClaimTransactionAdapter;
exports.PrismaRewardClaimTransactionAdapter = PrismaRewardClaimTransactionAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaRewardClaimTransactionAdapter);
//# sourceMappingURL=prisma-reward-claim-transaction.adapter.js.map