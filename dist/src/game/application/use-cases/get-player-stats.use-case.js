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
exports.GetPlayerStatsUseCase = void 0;
const common_1 = require("@nestjs/common");
const game_tokens_1 = require("../../game.tokens");
let GetPlayerStatsUseCase = class GetPlayerStatsUseCase {
    constructor(repository, playerClinicalStatsPort) {
        this.repository = repository;
        this.playerClinicalStatsPort = playerClinicalStatsPort;
    }
    async execute(user) {
        const clinicalStats = await this.playerClinicalStatsPort.getStats(user);
        const [playerProgress, currentBoss] = await Promise.all([
            this.repository.findPlayerProgress(user.userId, user.tenantId),
            this.repository.findActiveBoss(user.tenantId),
        ]);
        const currentLevel = playerProgress?.currentLevel || 1;
        return {
            level: currentLevel,
            currentXp: playerProgress?.currentXp || 0,
            nextLevelXp: currentLevel * 1000,
            totalDamageDealt: clinicalStats.totalDamage || 0,
            boss: currentBoss
                ? {
                    name: currentBoss.name,
                    hpPercentage: Math.max(0, Math.round((currentBoss.currentHp.toNumber() / currentBoss.maxHp.toNumber()) * 100)),
                    currentHp: Math.max(0, currentBoss.currentHp.toNumber()),
                }
                : null,
        };
    }
};
exports.GetPlayerStatsUseCase = GetPlayerStatsUseCase;
exports.GetPlayerStatsUseCase = GetPlayerStatsUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(game_tokens_1.GAME_REPOSITORY)),
    __param(1, (0, common_1.Inject)(game_tokens_1.PLAYER_CLINICAL_STATS_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], GetPlayerStatsUseCase);
//# sourceMappingURL=get-player-stats.use-case.js.map