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
exports.AchievementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const event_emitter_1 = require("@nestjs/event-emitter");
let AchievementsService = class AchievementsService {
    constructor(prisma, eventEmitter) {
        this.prisma = prisma;
        this.eventEmitter = eventEmitter;
    }
    async checkLevelAchievements(patientId, tenantId, newLevel) {
        const rewardsConfig = {
            2: { title: 'Medalha de Nível 2', icon: 'award' },
            5: { title: 'Guerreiro de Elite', icon: 'shield-star' },
            10: { title: 'Guerreiro de Prata', icon: 'silver-blade' },
            20: { title: 'Mestre de Ouro', icon: 'gold-crown' }
        };
        const achievement = rewardsConfig[newLevel];
        if (!achievement)
            return;
        const reward = await this.prisma.reward.upsert({
            where: {
                title_tenantId: { title: achievement.title, tenantId }
            },
            update: {},
            create: {
                tenantId,
                title: achievement.title,
                requiredDamage: 0,
                badgeIcon: achievement.icon,
                isActive: true
            }
        });
        const alreadyClaimed = await this.prisma.rewardClaim.findFirst({
            where: {
                patientId,
                rewardId: reward.id
            }
        });
        if (!alreadyClaimed) {
            await this.prisma.rewardClaim.create({
                data: {
                    rewardId: reward.id,
                    patientId,
                    tenantId,
                }
            });
            this.eventEmitter.emit('achievement.unlocked', {
                patientId,
                tenantId,
                achievement: achievement.title
            });
        }
    }
};
exports.AchievementsService = AchievementsService;
exports.AchievementsService = AchievementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, event_emitter_1.EventEmitter2])
], AchievementsService);
//# sourceMappingURL=achievements.service.js.map