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
exports.UpdatePatientProfileUseCase = void 0;
const common_1 = require("@nestjs/common");
const patients_tokens_1 = require("../../patients.tokens");
const get_patient_by_id_use_case_1 = require("./get-patient-by-id.use-case");
let UpdatePatientProfileUseCase = class UpdatePatientProfileUseCase {
    constructor(getPatientByIdUseCase, repository) {
        this.getPatientByIdUseCase = getPatientByIdUseCase;
        this.repository = repository;
    }
    async execute(id, tenantId, updateProfileDto) {
        await this.getPatientByIdUseCase.execute(id, tenantId);
        return this.repository.updateProfile(id, tenantId, updateProfileDto);
    }
};
exports.UpdatePatientProfileUseCase = UpdatePatientProfileUseCase;
exports.UpdatePatientProfileUseCase = UpdatePatientProfileUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(patients_tokens_1.PATIENTS_REPOSITORY)),
    __metadata("design:paramtypes", [get_patient_by_id_use_case_1.GetPatientByIdUseCase, Object])
], UpdatePatientProfileUseCase);
//# sourceMappingURL=update-patient-profile.use-case.js.map