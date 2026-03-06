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
exports.PlayerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const records_service_1 = require("../records/records.service");
let PlayerService = class PlayerService {
    constructor(prisma, recordsService) {
        this.prisma = prisma;
        this.recordsService = recordsService;
    }
    async getPlayerStats(user) {
        const clinicalStats = await this.recordsService.getStats(user);
        const playerProgress = await this.prisma.playerStats.findUnique({
            where: { patientId: user.userId },
        });
        const currentBoss = await this.prisma.bossBattle.findFirst({
            where: { tenantId: user.tenantId, isActive: true },
        });
        return {
            level: playerProgress?.currentLevel || 1,
            currentXp: playerProgress?.currentXp || 0,
            nextLevelXp: (playerProgress?.currentLevel || 1) * 1000,
            totalDamageDealt: clinicalStats.totalDamage || 0,
            boss: currentBoss ? {
                name: currentBoss.name,
                hpPercentage: Math.max(0, Math.round((currentBoss.currentHp.toNumber() / currentBoss.maxHp.toNumber()) * 100)),
                currentHp: Math.max(0, currentBoss.currentHp.toNumber())
            } : null
        };
    }
};
exports.PlayerService = PlayerService;
exports.PlayerService = PlayerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        records_service_1.RecordsService])
], PlayerService);
//# sourceMappingURL=player.service.js.map