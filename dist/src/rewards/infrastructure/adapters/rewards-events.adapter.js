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
exports.RewardsEventsAdapter = void 0;
const common_1 = require("@nestjs/common");
const application_events_1 = require("../../../shared/application/events/application-events");
const shared_tokens_1 = require("../../../shared/shared.tokens");
let RewardsEventsAdapter = class RewardsEventsAdapter {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    async emitRewardClaimed(input) {
        this.eventBus.publish((0, application_events_1.createApplicationEvent)(application_events_1.APPLICATION_EVENTS.rewardClaimed, {
            userId: input.userId,
            tenantId: input.tenantId,
            rewardTitle: input.achievement,
        }));
    }
};
exports.RewardsEventsAdapter = RewardsEventsAdapter;
exports.RewardsEventsAdapter = RewardsEventsAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(shared_tokens_1.APPLICATION_EVENT_BUS)),
    __metadata("design:paramtypes", [Object])
], RewardsEventsAdapter);
//# sourceMappingURL=rewards-events.adapter.js.map