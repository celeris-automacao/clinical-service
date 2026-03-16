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
exports.UpdateStaffMemberUseCase = void 0;
const common_1 = require("@nestjs/common");
const staff_tokens_1 = require("../../staff.tokens");
let UpdateStaffMemberUseCase = class UpdateStaffMemberUseCase {
    constructor(repository, auditLogPort) {
        this.repository = repository;
        this.auditLogPort = auditLogPort;
    }
    async execute(id, tenantId, dto, actorUserId) {
        const existingStaff = await this.repository.findById(id, tenantId);
        if (!existingStaff) {
            throw new common_1.NotFoundException('Profissional nao encontrado na clinica.');
        }
        if (dto.document) {
            const existingDocument = await this.repository.findByDocument(dto.document, tenantId, id);
            if (existingDocument) {
                throw new common_1.BadRequestException('Ja existe um profissional com este documento na clinica.');
            }
        }
        if (dto.licenseNumber) {
            const existingLicense = await this.repository.findByLicenseNumber(dto.licenseNumber, tenantId, id);
            if (existingLicense) {
                throw new common_1.BadRequestException('Ja existe um profissional com este registro na clinica.');
            }
        }
        const updated = await this.repository.update(id, tenantId, dto);
        if (actorUserId) {
            await this.auditLogPort.create({
                tenantId,
                actorUserId,
                targetStaffId: id,
                action: 'staff.updated',
                metadata: dto,
            });
        }
        return updated;
    }
};
exports.UpdateStaffMemberUseCase = UpdateStaffMemberUseCase;
exports.UpdateStaffMemberUseCase = UpdateStaffMemberUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(staff_tokens_1.STAFF_REPOSITORY)),
    __param(1, (0, common_1.Inject)(staff_tokens_1.STAFF_AUDIT_LOG_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], UpdateStaffMemberUseCase);
//# sourceMappingURL=update-staff-member.use-case.js.map