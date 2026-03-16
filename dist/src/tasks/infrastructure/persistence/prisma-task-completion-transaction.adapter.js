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
exports.PrismaTaskCompletionTransactionAdapter = void 0;
const common_1 = require("@nestjs/common");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaTaskCompletionTransactionAdapter = class PrismaTaskCompletionTransactionAdapter {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async execute(input) {
        return this.tenantScopedPrismaFactory.runInTenantTransaction({ userId: input.patientId, tenantId: input.tenantId }, async (tx) => {
            await tx.taskAssignment.update({
                where: { id: input.assignmentId },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                },
            });
            const stats = await tx.playerStats.upsert({
                where: { patientId: input.patientId },
                update: {},
                create: {
                    patientId: input.patientId,
                    tenantId: input.tenantId,
                    currentXp: 0,
                    currentLevel: 1,
                },
            });
            const newXp = stats.currentXp + input.xpReward;
            const xpToNextLevel = stats.currentLevel * 1000;
            const leveledUp = newXp >= xpToNextLevel;
            const newLevel = leveledUp ? stats.currentLevel + 1 : stats.currentLevel;
            await tx.playerStats.update({
                where: { patientId: input.patientId },
                data: {
                    currentXp: newXp,
                    currentLevel: newLevel,
                    totalDamageDealt: { increment: input.xpReward },
                    currentGold: { increment: input.xpReward },
                    lastActivityAt: new Date(),
                },
            });
            const activeBoss = await tx.bossBattle.findFirst({
                where: { tenantId: input.tenantId, isActive: true },
            });
            if (!activeBoss) {
                return {
                    newXp,
                    newLevel,
                    leveledUp,
                    bossDamage: 0,
                };
            }
            const newHp = Number(activeBoss.currentHp) - input.xpReward;
            if (newHp <= 0) {
                return {
                    newXp,
                    newLevel,
                    leveledUp,
                    bossDamage: input.xpReward,
                    defeatedBossId: activeBoss.id,
                };
            }
            await tx.bossBattle.update({
                where: { id: activeBoss.id },
                data: { currentHp: newHp },
            });
            return {
                newXp,
                newLevel,
                leveledUp,
                bossDamage: input.xpReward,
            };
        });
    }
};
exports.PrismaTaskCompletionTransactionAdapter = PrismaTaskCompletionTransactionAdapter;
exports.PrismaTaskCompletionTransactionAdapter = PrismaTaskCompletionTransactionAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaTaskCompletionTransactionAdapter);
//# sourceMappingURL=prisma-task-completion-transaction.adapter.js.map