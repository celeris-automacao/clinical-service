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
exports.AchievementsService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
let AchievementsService = class AchievementsService {
    constructor(repository, eventEmitter) {
        this.repository = repository;
        this.eventEmitter = eventEmitter;
    }
    async checkLevelAchievements(patientId, tenantId, newLevel) {
        const rewardsConfig = {
            2: { title: 'Medalha de Nível 2', icon: 'award' },
            5: { title: 'Guerreiro de Elite', icon: 'shield-star' },
            10: { title: 'Guerreiro de Prata', icon: 'silver-blade' },
            20: { title: 'Mestre de Ouro', icon: 'gold-crown' }
        };
        const config = rewardsConfig[newLevel];
        if (!config)
            return;
        const reward = await this.repository.getOrCreateBadge(tenantId, config.title, config.icon);
        const alreadyClaimed = await this.repository.findClaim(patientId, reward.id);
        if (!alreadyClaimed) {
            await this.repository.createClaim(patientId, tenantId, reward.id);
            this.eventEmitter.emit('achievement.unlocked', {
                patientId,
                tenantId,
                achievement: config.title
            });
        }
    }
    async emitGlobalVictory(tenantId, message) {
        this.eventEmitter.emit('boss.defeated.global', {
            tenantId,
            message,
            timestamp: new Date(),
        });
        console.log(`🏆 Vitória Global emita para o tenant ${tenantId}: ${message}`);
    }
};
exports.AchievementsService = AchievementsService;
exports.AchievementsService = AchievementsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('IAchievementsRepository')),
    __metadata("design:paramtypes", [Object, event_emitter_1.EventEmitter2])
], AchievementsService);
//# sourceMappingURL=achievements.service.js.map