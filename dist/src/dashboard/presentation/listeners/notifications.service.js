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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const application_events_1 = require("../../../shared/application/events/application-events");
const dashboard_tokens_1 = require("../../dashboard.tokens");
let NotificationsService = class NotificationsService {
    constructor(repository) {
        this.repository = repository;
    }
    async handleAchievement(event) {
        const payload = event.payload;
        await this.repository.createNotification({
            tenantId: payload.tenantId,
            userId: payload.patientId,
            title: 'NOVA CONQUISTA!',
            message: `Paciente ${payload.patientId} desbloqueou "${payload.achievement}"`,
            type: 'achievement',
        });
    }
    async handleBossDefeated(event) {
        const payload = event.payload;
        await this.repository.createNotification({
            tenantId: payload.tenantId,
            userId: payload.killerId,
            title: 'VITORIA EPICA!',
            message: `O Boss "${payload.bossName}" foi derrotado pelo paciente ${payload.killerId}!`,
            type: 'boss_defeat',
        });
    }
};
exports.NotificationsService = NotificationsService;
__decorate([
    (0, event_emitter_1.OnEvent)(application_events_1.APPLICATION_EVENTS.achievementUnlocked),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsService.prototype, "handleAchievement", null);
__decorate([
    (0, event_emitter_1.OnEvent)(application_events_1.APPLICATION_EVENTS.bossDefeated),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsService.prototype, "handleBossDefeated", null);
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(dashboard_tokens_1.NOTIFICATIONS_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map