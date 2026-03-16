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
exports.RecordsAchievementsAdapter = void 0;
const common_1 = require("@nestjs/common");
const check_level_achievements_use_case_1 = require("../../../achievements/application/use-cases/check-level-achievements.use-case");
const emit_boss_defeated_use_case_1 = require("../../../achievements/application/use-cases/emit-boss-defeated.use-case");
const emit_global_victory_use_case_1 = require("../../../achievements/application/use-cases/emit-global-victory.use-case");
let RecordsAchievementsAdapter = class RecordsAchievementsAdapter {
    constructor(checkLevelAchievementsUseCase, emitBossDefeatedUseCase, emitGlobalVictoryUseCase) {
        this.checkLevelAchievementsUseCase = checkLevelAchievementsUseCase;
        this.emitBossDefeatedUseCase = emitBossDefeatedUseCase;
        this.emitGlobalVictoryUseCase = emitGlobalVictoryUseCase;
    }
    async checkLevelAchievements(input) {
        await this.checkLevelAchievementsUseCase.execute(input);
    }
    async emitBossDefeated(input) {
        await this.emitBossDefeatedUseCase.execute(input);
    }
    async emitGlobalVictory(input) {
        await this.emitGlobalVictoryUseCase.execute(input);
    }
};
exports.RecordsAchievementsAdapter = RecordsAchievementsAdapter;
exports.RecordsAchievementsAdapter = RecordsAchievementsAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [check_level_achievements_use_case_1.CheckLevelAchievementsUseCase,
        emit_boss_defeated_use_case_1.EmitBossDefeatedUseCase,
        emit_global_victory_use_case_1.EmitGlobalVictoryUseCase])
], RecordsAchievementsAdapter);
//# sourceMappingURL=records-achievements.adapter.js.map