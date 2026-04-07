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
exports.GetPendingUpgradeRequestUseCase = void 0;
const common_1 = require("@nestjs/common");
const plans_tokens_1 = require("../../plans.tokens");
let GetPendingUpgradeRequestUseCase = class GetPendingUpgradeRequestUseCase {
    constructor(plansRepository) {
        this.plansRepository = plansRepository;
    }
    async execute(tenantId) {
        return this.plansRepository.findPendingUpgradeRequestByTenantId(tenantId);
    }
};
exports.GetPendingUpgradeRequestUseCase = GetPendingUpgradeRequestUseCase;
exports.GetPendingUpgradeRequestUseCase = GetPendingUpgradeRequestUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(plans_tokens_1.PLANS_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], GetPendingUpgradeRequestUseCase);
//# sourceMappingURL=get-pending-upgrade-request.use-case.js.map