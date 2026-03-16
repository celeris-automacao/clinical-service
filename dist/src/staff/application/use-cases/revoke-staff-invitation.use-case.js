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
exports.RevokeStaffInvitationUseCase = void 0;
const common_1 = require("@nestjs/common");
const staff_tokens_1 = require("../../staff.tokens");
let RevokeStaffInvitationUseCase = class RevokeStaffInvitationUseCase {
    constructor(repository, auditLogPort) {
        this.repository = repository;
        this.auditLogPort = auditLogPort;
    }
    async execute(id, tenantId, actorUserId) {
        const invitation = await this.repository.findInvitationById(id, tenantId);
        if (!invitation) {
            throw new common_1.NotFoundException('Convite nao encontrado.');
        }
        if (invitation.status !== 'pending') {
            throw new common_1.BadRequestException('Apenas convites pendentes podem ser revogados.');
        }
        const revoked = await this.repository.revokeInvitation(id, actorUserId, tenantId);
        await this.auditLogPort.create({
            tenantId,
            actorUserId,
            action: 'staff.invitation_revoked',
            metadata: {
                invitationId: id,
                email: invitation.email,
            },
        });
        return revoked;
    }
};
exports.RevokeStaffInvitationUseCase = RevokeStaffInvitationUseCase;
exports.RevokeStaffInvitationUseCase = RevokeStaffInvitationUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(staff_tokens_1.STAFF_REPOSITORY)),
    __param(1, (0, common_1.Inject)(staff_tokens_1.STAFF_AUDIT_LOG_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], RevokeStaffInvitationUseCase);
//# sourceMappingURL=revoke-staff-invitation.use-case.js.map