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
exports.MapSupabaseUserUseCase = void 0;
const common_1 = require("@nestjs/common");
const get_staff_member_by_user_id_use_case_1 = require("../../../staff/application/use-cases/get-staff-member-by-user-id.use-case");
let MapSupabaseUserUseCase = class MapSupabaseUserUseCase {
    constructor(getStaffMemberByUserIdUseCase) {
        this.getStaffMemberByUserIdUseCase = getStaffMemberByUserIdUseCase;
    }
    async execute(payload) {
        const userId = payload?.sub;
        const tenantId = payload?.user_metadata?.tenant_id;
        if (!userId || !tenantId) {
            throw new common_1.UnauthorizedException('JWT sem contexto de tenant ou usuario.');
        }
        const staffMember = await this.getStaffMemberByUserIdUseCase.execute(userId, tenantId);
        if (staffMember && staffMember.status !== 'active') {
            throw new common_1.UnauthorizedException('Profissional inativo ou bloqueado.');
        }
        return {
            userId,
            tenantId,
            role: staffMember?.role || payload.user_metadata?.role || 'patient',
            staffId: staffMember?.id,
            email: payload.email,
        };
    }
};
exports.MapSupabaseUserUseCase = MapSupabaseUserUseCase;
exports.MapSupabaseUserUseCase = MapSupabaseUserUseCase = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [get_staff_member_by_user_id_use_case_1.GetStaffMemberByUserIdUseCase])
], MapSupabaseUserUseCase);
//# sourceMappingURL=map-supabase-user.use-case.js.map