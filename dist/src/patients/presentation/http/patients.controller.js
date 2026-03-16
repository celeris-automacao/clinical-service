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
exports.PatientsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const create_patient_use_case_1 = require("../../application/use-cases/create-patient.use-case");
const get_patient_by_id_use_case_1 = require("../../application/use-cases/get-patient-by-id.use-case");
const update_patient_profile_use_case_1 = require("../../application/use-cases/update-patient-profile.use-case");
const create_patient_dto_1 = require("./dto/create-patient.dto");
const update_patient_profile_dto_1 = require("./dto/update-patient-profile.dto");
let PatientsController = class PatientsController {
    constructor(createPatientUseCase, getPatientByIdUseCase, updatePatientProfileUseCase) {
        this.createPatientUseCase = createPatientUseCase;
        this.getPatientByIdUseCase = getPatientByIdUseCase;
        this.updatePatientProfileUseCase = updatePatientProfileUseCase;
    }
    create(createPatientDto, user) {
        return this.createPatientUseCase.execute(createPatientDto, user.tenantId);
    }
    findOne(id, user) {
        return this.getPatientByIdUseCase.execute(id, user.tenantId);
    }
    updateProfile(id, updateProfileDto, user) {
        return this.updatePatientProfileUseCase.execute(id, user.tenantId, updateProfileDto);
    }
};
exports.PatientsController = PatientsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_patient_dto_1.CreatePatientDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/profile'),
    (0, swagger_1.ApiOperation)({ summary: 'Realizar o intake clinico (objetivos e queixas)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_patient_profile_dto_1.UpdatePatientProfileDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "updateProfile", null);
exports.PatientsController = PatientsController = __decorate([
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    (0, common_1.Controller)('patients'),
    __metadata("design:paramtypes", [create_patient_use_case_1.CreatePatientUseCase,
        get_patient_by_id_use_case_1.GetPatientByIdUseCase,
        update_patient_profile_use_case_1.UpdatePatientProfileUseCase])
], PatientsController);
//# sourceMappingURL=patients.controller.js.map