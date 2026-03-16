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
exports.AcceptStaffInvitationUseCase = void 0;
const common_1 = require("@nestjs/common");
const staff_tokens_1 = require("../../staff.tokens");
let AcceptStaffInvitationUseCase = class AcceptStaffInvitationUseCase {
    constructor(repository, auditLogPort) {
        this.repository = repository;
        this.auditLogPort = auditLogPort;
    }
    async execute(dto, user) {
        const invitation = await this.repository.findInvitationByToken(dto.token);
        if (!invitation) {
            throw new common_1.NotFoundException('Convite nao encontrado.');
        }
        if (invitation.status !== 'pending') {
            throw new common_1.BadRequestException('Este convite nao esta mais pendente.');
        }
        if (new Date(invitation.expiresAt).getTime() < Date.now()) {
            throw new common_1.BadRequestException('Este convite expirou.');
        }
        if (invitation.tenantId !== user.tenantId) {
            throw new common_1.BadRequestException('O convite nao pertence ao tenant autenticado.');
        }
        if (user.email && invitation.email !== user.email) {
            throw new common_1.BadRequestException('O email autenticado nao corresponde ao convite.');
        }
        const existingUser = await this.repository.findByUserId(user.userId, user.tenantId);
        if (existingUser) {
            throw new common_1.BadRequestException('Este usuario ja possui vinculo de staff na clinica.');
        }
        const existingDocument = await this.repository.findByDocument(invitation.document, user.tenantId);
        if (existingDocument) {
            throw new common_1.BadRequestException('Ja existe um profissional com este documento na clinica.');
        }
        if (invitation.licenseNumber) {
            const existingLicense = await this.repository.findByLicenseNumber(invitation.licenseNumber, user.tenantId);
            if (existingLicense) {
                throw new common_1.BadRequestException('Ja existe um profissional com este registro na clinica.');
            }
        }
        const staffMember = await this.repository.create({
            tenantId: user.tenantId,
            userId: user.userId,
            name: invitation.name,
            document: invitation.document,
            email: invitation.email,
            professionalType: invitation.professionalType,
            specialty: invitation.specialty,
            role: invitation.role,
            licenseNumber: invitation.licenseNumber || undefined,
            status: 'active',
        });
        await this.repository.acceptInvitation(dto.token, user.userId, user.tenantId);
        await this.auditLogPort.create({
            tenantId: user.tenantId,
            actorUserId: user.userId,
            targetStaffId: staffMember.id,
            action: 'staff.invitation_accepted',
            metadata: {
                invitationId: invitation.id,
            },
        });
        return staffMember;
    }
};
exports.AcceptStaffInvitationUseCase = AcceptStaffInvitationUseCase;
exports.AcceptStaffInvitationUseCase = AcceptStaffInvitationUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(staff_tokens_1.STAFF_REPOSITORY)),
    __param(1, (0, common_1.Inject)(staff_tokens_1.STAFF_AUDIT_LOG_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], AcceptStaffInvitationUseCase);
//# sourceMappingURL=accept-staff-invitation.use-case.js.map