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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const notifications_repository_1 = require("./repositories/notifications.repository");
let NotificationsService = class NotificationsService {
    constructor(repository) {
        this.repository = repository;
    }
    async handleAchievement(payload) {
        const title = '🏆 NOVA CONQUISTA!';
        const message = `Paciente ${payload.patientId} desbloqueou "${payload.achievement}"`;
        await this.repository.createNotification({
            tenantId: payload.tenantId,
            userId: payload.patientId,
            title,
            message,
            type: 'achievement'
        });
        console.log(`[Notification System] ${title}: ${message}`);
    }
    async handleBossDefeated(payload) {
        const title = '📢 VITÓRIA ÉPICA!';
        const message = `O Boss "${payload.bossName}" foi derrotado pelo paciente ${payload.killerId}!`;
        await this.repository.createNotification({
            tenantId: payload.tenantId,
            userId: payload.killerId,
            title,
            message,
            type: 'boss_defeat'
        });
        console.log('\n' + '='.repeat(40));
        console.log(title);
        console.log(`🏥 Clínica: ${payload.tenantId}`);
        console.log(`⚔️ ${message}`);
        console.log('='.repeat(40) + '\n');
    }
};
exports.NotificationsService = NotificationsService;
__decorate([
    (0, event_emitter_1.OnEvent)('achievement.unlocked'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsService.prototype, "handleAchievement", null);
__decorate([
    (0, event_emitter_1.OnEvent)('boss.defeated'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsService.prototype, "handleBossDefeated", null);
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notifications_repository_1.NotificationsRepository])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map