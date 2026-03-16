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
exports.CreateStaffInvitationUseCase = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const staff_tokens_1 = require("../../staff.tokens");
let CreateStaffInvitationUseCase = class CreateStaffInvitationUseCase {
    constructor(repository, auditLogPort) {
        this.repository = repository;
        this.auditLogPort = auditLogPort;
    }
    async execute(dto, tenantId, actorUserId) {
        const existingStaff = await this.repository.findByEmail(dto.email, tenantId);
        if (existingStaff) {
            throw new common_1.BadRequestException('Ja existe um profissional com este email na clinica.');
        }
        const existingInvitation = await this.repository.findPendingInvitationByEmail(dto.email, tenantId);
        if (existingInvitation) {
            throw new common_1.BadRequestException('Ja existe um convite pendente para este email.');
        }
        const existingDocument = await this.repository.findByDocument(dto.document, tenantId);
        if (existingDocument) {
            throw new common_1.BadRequestException('Ja existe um profissional com este documento na clinica.');
        }
        const existingPendingDocument = await this.repository.findPendingInvitationByDocument(dto.document, tenantId);
        if (existingPendingDocument) {
            throw new common_1.BadRequestException('Ja existe um convite pendente para este documento.');
        }
        if (dto.licenseNumber) {
            const existingLicense = await this.repository.findByLicenseNumber(dto.licenseNumber, tenantId);
            if (existingLicense) {
                throw new common_1.BadRequestException('Ja existe um profissional com este registro na clinica.');
            }
            const existingPendingLicense = await this.repository.findPendingInvitationByLicenseNumber(dto.licenseNumber, tenantId);
            if (existingPendingLicense) {
                throw new common_1.BadRequestException('Ja existe um convite pendente para este registro.');
            }
        }
        const invitation = await this.repository.createInvitation({
            ...dto,
            tenantId,
            invitedByUserId: actorUserId,
            token: (0, crypto_1.randomUUID)(),
            status: 'pending',
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        });
        await this.auditLogPort.create({
            tenantId,
            actorUserId,
            action: 'staff.invited',
            metadata: {
                invitationId: invitation.id,
                email: dto.email,
                document: dto.document,
                role: dto.role,
            },
        });
        return invitation;
    }
};
exports.CreateStaffInvitationUseCase = CreateStaffInvitationUseCase;
exports.CreateStaffInvitationUseCase = CreateStaffInvitationUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(staff_tokens_1.STAFF_REPOSITORY)),
    __param(1, (0, common_1.Inject)(staff_tokens_1.STAFF_AUDIT_LOG_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], CreateStaffInvitationUseCase);
//# sourceMappingURL=create-staff-invitation.use-case.js.map