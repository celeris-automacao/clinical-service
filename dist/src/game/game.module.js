"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameModule = void 0;
const common_1 = require("@nestjs/common");
const records_module_1 = require("../records/records.module");
const get_player_stats_use_case_1 = require("./application/use-cases/get-player-stats.use-case");
const records_player_clinical_stats_adapter_1 = require("./infrastructure/adapters/records-player-clinical-stats.adapter");
const game_controller_1 = require("./presentation/http/game.controller");
const prisma_game_repository_1 = require("./infrastructure/persistence/prisma-game.repository");
const game_tokens_1 = require("./game.tokens");
let GameModule = class GameModule {
};
exports.GameModule = GameModule;
exports.GameModule = GameModule = __decorate([
    (0, common_1.Module)({
        imports: [records_module_1.RecordsModule],
        controllers: [game_controller_1.GameController],
        providers: [
            get_player_stats_use_case_1.GetPlayerStatsUseCase,
            {
                provide: game_tokens_1.GAME_REPOSITORY,
                useClass: prisma_game_repository_1.PrismaGameRepository,
            },
            {
                provide: game_tokens_1.PLAYER_CLINICAL_STATS_PORT,
                useClass: records_player_clinical_stats_adapter_1.RecordsPlayerClinicalStatsAdapter,
            },
        ],
    })
], GameModule);
//# sourceMappingURL=game.module.js.map