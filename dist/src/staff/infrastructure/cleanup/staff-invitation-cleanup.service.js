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
exports.StaffInvitationCleanupService = void 0;
const common_1 = require("@nestjs/common");
const cleanup_expired_staff_invitations_use_case_1 = require("../../application/use-cases/cleanup-expired-staff-invitations.use-case");
let StaffInvitationCleanupService = class StaffInvitationCleanupService {
    constructor(cleanupExpiredStaffInvitationsUseCase) {
        this.cleanupExpiredStaffInvitationsUseCase = cleanupExpiredStaffInvitationsUseCase;
    }
    onModuleInit() {
        this.intervalRef = setInterval(() => {
            void this.cleanupExpiredStaffInvitationsUseCase.execute();
        }, 1000 * 60 * 60);
    }
    onModuleDestroy() {
        if (this.intervalRef) {
            clearInterval(this.intervalRef);
        }
    }
};
exports.StaffInvitationCleanupService = StaffInvitationCleanupService;
exports.StaffInvitationCleanupService = StaffInvitationCleanupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cleanup_expired_staff_invitations_use_case_1.CleanupExpiredStaffInvitationsUseCase])
], StaffInvitationCleanupService);
//# sourceMappingURL=staff-invitation-cleanup.service.js.map