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
exports.AchievementsEventsAdapter = void 0;
const common_1 = require("@nestjs/common");
const application_events_1 = require("../../../shared/application/events/application-events");
const shared_tokens_1 = require("../../../shared/shared.tokens");
let AchievementsEventsAdapter = class AchievementsEventsAdapter {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    async emitAchievementUnlocked(input) {
        this.eventBus.publish((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.achievementUnlocked, input));
    }
    async emitBossDefeated(input) {
        this.eventBus.publish((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.bossDefeated, input));
    }
    async emitBossDefeatedGlobal(input) {
        this.eventBus.publish((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.bossDefeatedGlobal, input));
    }
};
exports.AchievementsEventsAdapter = AchievementsEventsAdapter;
exports.AchievementsEventsAdapter = AchievementsEventsAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_tokens_1.APPLICATION_EVENT_BUS)),
    __metadata("design:paramtypes", [Object])
], AchievementsEventsAdapter);
//# sourceMappingURL=achievements-events.adapter.js.map