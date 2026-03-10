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
exports.GameService = void 0;
const common_1 = require("@nestjs/common");
const records_service_1 = require("../records/records.service");
let GameService = class GameService {
    constructor(repository, recordsService) {
        this.repository = repository;
        this.recordsService = recordsService;
    }
    async getPlayerStats(user) {
        const clinicalStats = await this.recordsService.getStats(user);
        const [playerProgress, currentBoss] = await Promise.all([
            this.repository.findPlayerProgress(user.userId),
            this.repository.findActiveBoss(user.tenantId)
        ]);
        const currentLevel = playerProgress?.currentLevel || 1;
        return {
            level: currentLevel,
            currentXp: playerProgress?.currentXp || 0,
            nextLevelXp: currentLevel * 1000,
            totalDamageDealt: clinicalStats.totalDamage || 0,
            boss: currentBoss ? {
                name: currentBoss.name,
                hpPercentage: Math.max(0, Math.round((currentBoss.currentHp.toNumber() / currentBoss.maxHp.toNumber()) * 100)),
                currentHp: Math.max(0, currentBoss.currentHp.toNumber())
            } : null
        };
    }
};
exports.GameService = GameService;
exports.GameService = GameService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('IGameRepository')),
    __metadata("design:paramtypes", [Object, records_service_1.RecordsService])
], GameService);
//# sourceMappingURL=game.service.js.map