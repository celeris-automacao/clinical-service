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
exports.CreateClinicalRecordUseCase = void 0;
const common_1 = require("@nestjs/common");
const clinical_progress_calculator_1 = require("../../domain/services/clinical-progress-calculator");
const records_tokens_1 = require("../../records.tokens");
const handle_boss_victory_use_case_1 = require("./handle-boss-victory.use-case");
let CreateClinicalRecordUseCase = class CreateClinicalRecordUseCase {
    constructor(repository, playerProgressionPort, bossBattlePort, recordsAchievementsPort, clinicalProgressCalculator, handleBossVictoryUseCase) {
        this.repository = repository;
        this.playerProgressionPort = playerProgressionPort;
        this.bossBattlePort = bossBattlePort;
        this.recordsAchievementsPort = recordsAchievementsPort;
        this.clinicalProgressCalculator = clinicalProgressCalculator;
        this.handleBossVictoryUseCase = handleBossVictoryUseCase;
    }
    async execute(dto, user) {
        const newRecord = await this.repository.create(dto, user.userId, user.tenantId);
        const damageDealt = await this.calculateAndApplyDamage(user.userId, user.tenantId);
        await this.playerProgressionPort.upsertClinicalProgress({
            patientId: user.userId,
            tenantId: user.tenantId,
            damageDealt,
        });
        const history = await this.repository.findAllByPatient(user.userId, user.tenantId);
        const stats = this.clinicalProgressCalculator.calculateStats(history);
        await this.recordsAchievementsPort.checkLevelAchievements({
            patientId: user.userId,
            tenantId: user.tenantId,
            newLevel: stats.currentLevel,
        });
        return {
            ...newRecord,
            damage: damageDealt,
            message: damageDealt > 0
                ? `ATAQUE CRITICO! Voce causou ${damageDealt.toLocaleString()} de dano no Boss!`
                : 'Registro salvo. Continue focado na sua evolucao!',
        };
    }
    async handleBossVictory(bossId, tenantId, killerId) {
        return this.handleBossVictoryUseCase.execute(bossId, tenantId, killerId);
    }
    async calculateAndApplyDamage(userId, tenantId) {
        const records = await this.repository.findLastTwo(userId, tenantId);
        const totalDamage = this.clinicalProgressCalculator.calculateDamageFromLatestRecords(records);
        if (totalDamage <= 0) {
            return 0;
        }
        const boss = await this.bossBattlePort.findActiveBoss(tenantId);
        if (!boss) {
            return totalDamage;
        }
        const newHp = boss.currentHp - totalDamage;
        if (newHp <= 0) {
            await this.handleBossVictoryUseCase.execute(boss.id, tenantId, userId);
        }
        else {
            await this.bossBattlePort.applyDamage(boss.id, newHp, tenantId);
        }
        return totalDamage;
    }
};
exports.CreateClinicalRecordUseCase = CreateClinicalRecordUseCase;
exports.CreateClinicalRecordUseCase = CreateClinicalRecordUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(records_tokens_1.RECORDS_REPOSITORY)),
    __param(1, (0, common_1.Inject)(records_tokens_1.PLAYER_PROGRESSION_PORT)),
    __param(2, (0, common_1.Inject)(records_tokens_1.BOSS_BATTLE_PORT)),
    __param(3, (0, common_1.Inject)(records_tokens_1.RECORDS_ACHIEVEMENTS_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, clinical_progress_calculator_1.ClinicalProgressCalculator,
        handle_boss_victory_use_case_1.HandleBossVictoryUseCase])
], CreateClinicalRecordUseCase);
//# sourceMappingURL=create-clinical-record.use-case.js.map