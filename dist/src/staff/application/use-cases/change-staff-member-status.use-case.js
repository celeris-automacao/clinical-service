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
exports.ChangeStaffMemberStatusUseCase = void 0;
const common_1 = require("@nestjs/common");
const staff_constants_1 = require("../../domain/staff.constants");
const staff_tokens_1 = require("../../staff.tokens");
let ChangeStaffMemberStatusUseCase = class ChangeStaffMemberStatusUseCase {
    constructor(repository, auditLogPort) {
        this.repository = repository;
        this.auditLogPort = auditLogPort;
    }
    async execute(id, tenantId, status, actorUserId) {
        const existingStaff = await this.repository.findById(id, tenantId);
        if (!existingStaff) {
            throw new common_1.NotFoundException('Profissional nao encontrado na clinica.');
        }
        const isProtectedRole = staff_constants_1.PROTECTED_STAFF_ROLES.includes(existingStaff.role);
        const isDeactivation = status !== 'active';
        if (isProtectedRole && existingStaff.status === 'active' && isDeactivation) {
            const activeCount = await this.repository.countActiveByRole(tenantId, existingStaff.role);
            if (activeCount <= 1) {
                throw new common_1.BadRequestException(`Nao e permitido inativar o ultimo ${existingStaff.role} ativo da clinica.`);
            }
        }
        const updated = await this.repository.changeStatus(id, tenantId, status);
        if (actorUserId) {
            await this.auditLogPort.create({
                tenantId,
                actorUserId,
                targetStaffId: id,
                action: 'staff.status_changed',
                metadata: {
                    previousStatus: existingStaff.status,
                    newStatus: status,
                },
            });
        }
        return updated;
    }
};
exports.ChangeStaffMemberStatusUseCase = ChangeStaffMemberStatusUseCase;
exports.ChangeStaffMemberStatusUseCase = ChangeStaffMemberStatusUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(staff_tokens_1.STAFF_REPOSITORY)),
    __param(1, (0, common_1.Inject)(staff_tokens_1.STAFF_AUDIT_LOG_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], ChangeStaffMemberStatusUseCase);
//# sourceMappingURL=change-staff-member-status.use-case.js.map