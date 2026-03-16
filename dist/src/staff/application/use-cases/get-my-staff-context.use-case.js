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
exports.GetMyStaffContextUseCase = void 0;
const common_1 = require("@nestjs/common");
const get_staff_member_by_user_id_use_case_1 = require("./get-staff-member-by-user-id.use-case");
let GetMyStaffContextUseCase = class GetMyStaffContextUseCase {
    constructor(getStaffMemberByUserIdUseCase) {
        this.getStaffMemberByUserIdUseCase = getStaffMemberByUserIdUseCase;
    }
    async execute(user) {
        const staffMember = await this.getStaffMemberByUserIdUseCase.execute(user.userId, user.tenantId);
        return {
            userId: user.userId,
            tenantId: user.tenantId,
            role: user.role,
            email: user.email,
            staff: staffMember
                ? {
                    id: staffMember.id,
                    name: staffMember.name,
                    role: staffMember.role,
                    status: staffMember.status,
                    specialty: staffMember.specialty,
                    professionalType: staffMember.professionalType,
                    licenseNumber: staffMember.licenseNumber,
                }
                : null,
        };
    }
};
exports.GetMyStaffContextUseCase = GetMyStaffContextUseCase;
exports.GetMyStaffContextUseCase = GetMyStaffContextUseCase = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [get_staff_member_by_user_id_use_case_1.GetStaffMemberByUserIdUseCase])
], GetMyStaffContextUseCase);
//# sourceMappingURL=get-my-staff-context.use-case.js.map