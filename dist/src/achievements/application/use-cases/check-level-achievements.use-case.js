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
exports.CheckLevelAchievementsUseCase = void 0;
const common_1 = require("@nestjs/common");
const achievements_tokens_1 = require("../../achievements.tokens");
let CheckLevelAchievementsUseCase = class CheckLevelAchievementsUseCase {
    constructor(repository, eventsPort) {
        this.repository = repository;
        this.eventsPort = eventsPort;
    }
    async execute(input) {
        const rewardsConfig = {
            2: { title: 'Medalha de Nível 2', icon: 'award' },
            5: { title: 'Guerreiro de Elite', icon: 'shield-star' },
            7: { title: 'Desbravador Clínico', icon: 'map' },
            10: { title: 'Guerreiro de Prata', icon: 'silver-blade' },
            20: { title: 'Mestre de Ouro', icon: 'gold-crown' },
        };
        const config = rewardsConfig[input.newLevel];
        if (!config) {
            return;
        }
        const reward = await this.repository.getOrCreateBadge(input.tenantId, config.title, config.icon);
        const alreadyClaimed = await this.repository.findClaim(input.patientId, reward.id);
        if (alreadyClaimed) {
            return;
        }
        await this.repository.createClaim(input.patientId, input.tenantId, reward.id);
        await this.eventsPort.emitAchievementUnlocked({
            patientId: input.patientId,
            tenantId: input.tenantId,
            achievement: config.title,
        });
    }
};
exports.CheckLevelAchievementsUseCase = CheckLevelAchievementsUseCase;
exports.CheckLevelAchievementsUseCase = CheckLevelAchievementsUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(achievements_tokens_1.ACHIEVEMENTS_REPOSITORY)),
    __param(1, (0, common_1.Inject)(achievements_tokens_1.ACHIEVEMENTS_EVENTS_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], CheckLevelAchievementsUseCase);
//# sourceMappingURL=check-level-achievements.use-case.js.map