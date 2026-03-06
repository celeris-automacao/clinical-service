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
exports.SocialListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const social_service_1 = require("./social.service");
let SocialListener = class SocialListener {
    constructor(socialService) {
        this.socialService = socialService;
    }
    async handleBossDefeated(payload) {
        await this.socialService.createPost(payload.killerId, payload.tenantId, `⚔️ O Boss ${payload.bossName} foi derrotado! Vitória épica para a clínica!`, 'boss_defeat');
    }
    async handleAchievement(payload) {
        await this.socialService.createPost(payload.patientId, payload.tenantId, `🏆 Desbloqueou a conquista: ${payload.achievement}!`, 'achievement');
    }
};
exports.SocialListener = SocialListener;
__decorate([
    (0, event_emitter_1.OnEvent)('boss.defeated'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SocialListener.prototype, "handleBossDefeated", null);
__decorate([
    (0, event_emitter_1.OnEvent)('achievement.unlocked'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SocialListener.prototype, "handleAchievement", null);
exports.SocialListener = SocialListener = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [social_service_1.SocialService])
], SocialListener);
//# sourceMappingURL=social.listener.js.map