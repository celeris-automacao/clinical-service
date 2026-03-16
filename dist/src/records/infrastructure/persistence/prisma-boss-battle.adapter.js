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
exports.PrismaBossBattleAdapter = void 0;
const common_1 = require("@nestjs/common");
const tenant_scope_1 = require("../../../shared/infrastructure/persistence/tenant-scope");
const tenant_scoped_prisma_factory_1 = require("../../../shared/infrastructure/persistence/tenant-scoped-prisma.factory");
let PrismaBossBattleAdapter = class PrismaBossBattleAdapter {
    constructor(tenantScopedPrismaFactory) {
        this.tenantScopedPrismaFactory = tenantScopedPrismaFactory;
    }
    async findActiveBoss(tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        const boss = await prisma.bossBattle.findFirst({
            where: (0, tenant_scope_1.byTenant)(tenantId, { isActive: true }),
        });
        if (!boss) {
            return null;
        }
        return {
            id: boss.id,
            currentHp: Number(boss.currentHp),
            maxHp: Number(boss.maxHp),
        };
    }
    async findById(bossId, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        const boss = await prisma.bossBattle.findFirst({
            where: (0, tenant_scope_1.byIdAndTenant)(bossId, tenantId),
        });
        if (!boss) {
            return null;
        }
        return {
            id: boss.id,
            name: boss.name,
            maxHp: Number(boss.maxHp),
        };
    }
    async applyDamage(bossId, newHp, tenantId) {
        const prisma = this.tenantScopedPrismaFactory.forTenant(tenantId);
        await prisma.bossBattle.updateMany({
            where: (0, tenant_scope_1.byIdAndTenant)(bossId, tenantId),
            data: { currentHp: newHp },
        });
    }
    async handleVictory(input) {
        await this.tenantScopedPrismaFactory.runInTenantTransaction({ userId: 'system', tenantId: input.tenantId }, async (tx) => {
            await tx.bossBattle.update({
                where: { id: input.bossId },
                data: { isActive: false, currentHp: 0, defeatedAt: new Date() },
            });
            await tx.playerStats.updateMany({
                where: { tenantId: input.tenantId },
                data: { currentGold: { increment: input.rewardGold } },
            });
            await tx.bossBattle.create({
                data: {
                    name: input.nextBossName,
                    maxHp: input.nextBossMaxHp,
                    currentHp: input.nextBossMaxHp,
                    tenantId: input.tenantId,
                    isActive: true,
                },
            });
        });
    }
};
exports.PrismaBossBattleAdapter = PrismaBossBattleAdapter;
exports.PrismaBossBattleAdapter = PrismaBossBattleAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory])
], PrismaBossBattleAdapter);
//# sourceMappingURL=prisma-boss-battle.adapter.js.map