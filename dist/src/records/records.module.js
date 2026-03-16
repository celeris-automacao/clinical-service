"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordsModule = void 0;
const common_1 = require("@nestjs/common");
const achievements_module_1 = require("../achievements/achievements.module");
const create_clinical_record_use_case_1 = require("./application/use-cases/create-clinical-record.use-case");
const get_patient_evolution_use_case_1 = require("./application/use-cases/get-patient-evolution.use-case");
const get_patient_stats_use_case_1 = require("./application/use-cases/get-patient-stats.use-case");
const handle_boss_victory_use_case_1 = require("./application/use-cases/handle-boss-victory.use-case");
const clinical_progress_calculator_1 = require("./domain/services/clinical-progress-calculator");
const records_achievements_adapter_1 = require("./infrastructure/adapters/records-achievements.adapter");
const prisma_boss_battle_adapter_1 = require("./infrastructure/persistence/prisma-boss-battle.adapter");
const prisma_player_progression_adapter_1 = require("./infrastructure/persistence/prisma-player-progression.adapter");
const records_controller_1 = require("./presentation/http/records.controller");
const prisma_records_repository_1 = require("./infrastructure/persistence/prisma-records.repository");
const records_tokens_1 = require("./records.tokens");
let RecordsModule = class RecordsModule {
};
exports.RecordsModule = RecordsModule;
exports.RecordsModule = RecordsModule = __decorate([
    (0, common_1.Module)({
        imports: [achievements_module_1.AchievementsModule],
        controllers: [records_controller_1.RecordsController],
        providers: [
            create_clinical_record_use_case_1.CreateClinicalRecordUseCase,
            handle_boss_victory_use_case_1.HandleBossVictoryUseCase,
            get_patient_stats_use_case_1.GetPatientStatsUseCase,
            get_patient_evolution_use_case_1.GetPatientEvolutionUseCase,
            clinical_progress_calculator_1.ClinicalProgressCalculator,
            {
                provide: records_tokens_1.RECORDS_REPOSITORY,
                useClass: prisma_records_repository_1.PrismaRecordsRepository,
            },
            {
                provide: records_tokens_1.PLAYER_PROGRESSION_PORT,
                useClass: prisma_player_progression_adapter_1.PrismaPlayerProgressionAdapter,
            },
            {
                provide: records_tokens_1.BOSS_BATTLE_PORT,
                useClass: prisma_boss_battle_adapter_1.PrismaBossBattleAdapter,
            },
            {
                provide: records_tokens_1.RECORDS_ACHIEVEMENTS_PORT,
                useClass: records_achievements_adapter_1.RecordsAchievementsAdapter,
            },
        ],
        exports: [handle_boss_victory_use_case_1.HandleBossVictoryUseCase, get_patient_stats_use_case_1.GetPatientStatsUseCase, records_tokens_1.RECORDS_REPOSITORY],
    })
], RecordsModule);
//# sourceMappingURL=records.module.js.map