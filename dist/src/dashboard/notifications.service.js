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
let NotificationsService = class NotificationsService {
    handleAchievement(payload) {
        console.log(`🏆 CONQUISTA NA CLÍNICA: Paciente ${payload.patientId} desbloqueou "${payload.achievement}"`);
    }
    handleBossDefeated(payload) {
        console.log('\n\n' + '='.repeat(40));
        console.log('📢 ALERTA DE VITÓRIA NA CLÍNICA!');
        console.log(`🏥 Clínica (Tenant): ${payload.tenantId}`);
        console.log(`🐉 O Boss "${payload.bossName}" foi derrotado!`);
        console.log(`⚔️ Golpe final desferido pelo paciente: ${payload.killerId}`);
        console.log('='.repeat(40) + '\n\n');
    }
};
exports.NotificationsService = NotificationsService;
__decorate([
    (0, event_emitter_1.OnEvent)('achievement.unlocked'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsService.prototype, "handleAchievement", null);
__decorate([
    (0, event_emitter_1.OnEvent)('boss.defeated'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsService.prototype, "handleBossDefeated", null);
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map