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
exports.CreateRewardUseCase = void 0;
const common_1 = require("@nestjs/common");
const rewards_tokens_1 = require("../../rewards.tokens");
let CreateRewardUseCase = class CreateRewardUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(dto, tenantId) {
        const existingReward = await this.repository.findByTitle(dto.title, tenantId);
        if (existingReward) {
            throw new common_1.BadRequestException('Ja existe uma recompensa com este titulo nesta clinica.');
        }
        return this.repository.create({
            ...dto,
            tenantId,
            isActive: dto.isActive ?? true,
        });
    }
};
exports.CreateRewardUseCase = CreateRewardUseCase;
exports.CreateRewardUseCase = CreateRewardUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(rewards_tokens_1.REWARDS_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], CreateRewardUseCase);
//# sourceMappingURL=create-reward.use-case.js.map