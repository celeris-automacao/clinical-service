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
exports.HandleBossVictoryUseCase = void 0;
const common_1 = require("@nestjs/common");
const clinical_progress_calculator_1 = require("../../domain/services/clinical-progress-calculator");
const records_tokens_1 = require("../../records.tokens");
let HandleBossVictoryUseCase = class HandleBossVictoryUseCase {
    constructor(bossBattlePort, recordsAchievementsPort, clinicalProgressCalculator) {
        this.bossBattlePort = bossBattlePort;
        this.recordsAchievementsPort = recordsAchievementsPort;
        this.clinicalProgressCalculator = clinicalProgressCalculator;
    }
    async execute(bossId, tenantId, killerId) {
        const oldBoss = await this.bossBattlePort.findById(bossId, tenantId);
        if (!oldBoss) {
            return;
        }
        const nextName = this.clinicalProgressCalculator.generateClinicalBossName();
        const nextMaxHp = Math.round(oldBoss.maxHp * 1.15);
        await this.bossBattlePort.handleVictory({
            bossId,
            tenantId,
            nextBossName: nextName,
            nextBossMaxHp: nextMaxHp,
            rewardGold: 5000,
        });
        await this.recordsAchievementsPort.emitBossDefeated({
            tenantId,
            bossId,
            bossName: oldBoss.name,
            killerId,
        });
        await this.recordsAchievementsPort.emitGlobalVictory({
            tenantId,
            message: `VITORIA! O "${nextName}" surgiu!`,
        });
    }
};
exports.HandleBossVictoryUseCase = HandleBossVictoryUseCase;
exports.HandleBossVictoryUseCase = HandleBossVictoryUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(records_tokens_1.BOSS_BATTLE_PORT)),
    __param(1, (0, common_1.Inject)(records_tokens_1.RECORDS_ACHIEVEMENTS_PORT)),
    __metadata("design:paramtypes", [Object, Object, clinical_progress_calculator_1.ClinicalProgressCalculator])
], HandleBossVictoryUseCase);
//# sourceMappingURL=handle-boss-victory.use-case.js.map