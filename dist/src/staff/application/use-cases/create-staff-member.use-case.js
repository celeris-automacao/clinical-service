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
exports.CreateStaffMemberUseCase = void 0;
const common_1 = require("@nestjs/common");
const shared_tokens_1 = require("../../../shared/shared.tokens");
const staff_tokens_1 = require("../../staff.tokens");
let CreateStaffMemberUseCase = class CreateStaffMemberUseCase {
    constructor(repository, auditLogPort, tenantPlanPort) {
        this.repository = repository;
        this.auditLogPort = auditLogPort;
        this.tenantPlanPort = tenantPlanPort;
    }
    async execute(dto, tenantId, actorUserId) {
        const [plan, staffCount] = await Promise.all([
            this.tenantPlanPort.getTenantPlan(tenantId),
            this.repository.countByTenant(tenantId),
        ]);
        if (!plan) {
            throw new common_1.BadRequestException('Clinica sem plano ativo.');
        }
        if (staffCount >= plan.maxStaff) {
            throw new common_1.BadRequestException('Limite de profissionais do plano atingido.');
        }
        const existingUser = await this.repository.findByUserId(dto.userId, tenantId);
        if (existingUser) {
            throw new common_1.BadRequestException('Ja existe um profissional com este usuario na clinica.');
        }
        const existingDocument = await this.repository.findByDocument(dto.document, tenantId);
        if (existingDocument) {
            throw new common_1.BadRequestException('Ja existe um profissional com este documento na clinica.');
        }
        if (dto.licenseNumber) {
            const existingLicense = await this.repository.findByLicenseNumber(dto.licenseNumber, tenantId);
            if (existingLicense) {
                throw new common_1.BadRequestException('Ja existe um profissional com este registro na clinica.');
            }
        }
        const staffMember = await this.repository.create({
            ...dto,
            tenantId,
            status: dto.status || 'active',
        });
        if (actorUserId) {
            await this.auditLogPort.create({
                tenantId,
                actorUserId,
                targetStaffId: staffMember.id,
                action: 'staff.created',
                metadata: {
                    role: staffMember.role,
                    professionalType: staffMember.professionalType,
                },
            });
        }
        return staffMember;
    }
};
exports.CreateStaffMemberUseCase = CreateStaffMemberUseCase;
exports.CreateStaffMemberUseCase = CreateStaffMemberUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(staff_tokens_1.STAFF_REPOSITORY)),
    __param(1, (0, common_1.Inject)(staff_tokens_1.STAFF_AUDIT_LOG_PORT)),
    __param(2, (0, common_1.Inject)(shared_tokens_1.TENANT_PLAN_PORT)),
    __metadata("design:paramtypes", [Object, Object, Object])
], CreateStaffMemberUseCase);
//# sourceMappingURL=create-staff-member.use-case.js.map