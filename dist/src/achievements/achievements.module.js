"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AchievementsModule = void 0;
const common_1 = require("@nestjs/common");
const check_level_achievements_use_case_1 = require("./application/use-cases/check-level-achievements.use-case");
const emit_boss_defeated_use_case_1 = require("./application/use-cases/emit-boss-defeated.use-case");
const emit_global_victory_use_case_1 = require("./application/use-cases/emit-global-victory.use-case");
const achievements_tokens_1 = require("./achievements.tokens");
const achievements_events_adapter_1 = require("./infrastructure/adapters/achievements-events.adapter");
const prisma_achievements_repository_1 = require("./infrastructure/persistence/prisma-achievements.repository");
let AchievementsModule = class AchievementsModule {
};
exports.AchievementsModule = AchievementsModule;
exports.AchievementsModule = AchievementsModule = __decorate([
    (0, common_1.Module)({
        providers: [
            check_level_achievements_use_case_1.CheckLevelAchievementsUseCase,
            emit_boss_defeated_use_case_1.EmitBossDefeatedUseCase,
            emit_global_victory_use_case_1.EmitGlobalVictoryUseCase,
            {
                provide: achievements_tokens_1.ACHIEVEMENTS_REPOSITORY,
                useClass: prisma_achievements_repository_1.PrismaAchievementsRepository,
            },
            {
                provide: achievements_tokens_1.ACHIEVEMENTS_EVENTS_PORT,
                useClass: achievements_events_adapter_1.AchievementsEventsAdapter,
            },
        ],
        exports: [
            check_level_achievements_use_case_1.CheckLevelAchievementsUseCase,
            emit_boss_defeated_use_case_1.EmitBossDefeatedUseCase,
            emit_global_victory_use_case_1.EmitGlobalVictoryUseCase,
            achievements_tokens_1.ACHIEVEMENTS_REPOSITORY,
        ],
    })
], AchievementsModule);
//# sourceMappingURL=achievements.module.js.map