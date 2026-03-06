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
const rewards_service_1 = require("./rewards.service");
const rewards_controller_1 = require("./rewards.controller");
const records_module_1 = require("../records/records.module");
const achievements_service_1 = require("./achievements.service");
const player_controller_1 = require("./player.controller");
const player_service_1 = require("./player.service");
let GameModule = class GameModule {
};
exports.GameModule = GameModule;
exports.GameModule = GameModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => records_module_1.RecordsModule),
        ],
        controllers: [rewards_controller_1.RewardsController, player_controller_1.PlayerController],
        providers: [rewards_service_1.RewardsService, achievements_service_1.AchievementsService, player_service_1.PlayerService],
        exports: [rewards_service_1.RewardsService, achievements_service_1.AchievementsService, player_service_1.PlayerService],
    })
], GameModule);
//# sourceMappingURL=game.module.js.map