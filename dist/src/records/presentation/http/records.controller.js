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
exports.RecordsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const create_clinical_record_use_case_1 = require("../../application/use-cases/create-clinical-record.use-case");
const get_patient_evolution_use_case_1 = require("../../application/use-cases/get-patient-evolution.use-case");
const get_patient_stats_use_case_1 = require("../../application/use-cases/get-patient-stats.use-case");
const create_record_dto_1 = require("./dto/create-record.dto");
const evolution_dto_1 = require("./dto/evolution.dto");
let RecordsController = class RecordsController {
    constructor(createClinicalRecordUseCase, getPatientEvolutionUseCase, getPatientStatsUseCase) {
        this.createClinicalRecordUseCase = createClinicalRecordUseCase;
        this.getPatientEvolutionUseCase = getPatientEvolutionUseCase;
        this.getPatientStatsUseCase = getPatientStatsUseCase;
    }
    createRecord(createRecordDto, user) {
        return this.createClinicalRecordUseCase.execute(createRecordDto, user);
    }
    getEvolution(user) {
        return this.getPatientEvolutionUseCase.execute(user);
    }
    getStats(user) {
        return this.getPatientStatsUseCase.execute(user);
    }
};
exports.RecordsController = RecordsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_record_dto_1.CreateRecordDto, Object]),
    __metadata("design:returntype", void 0)
], RecordsController.prototype, "createRecord", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Busca histórico de evolução' }),
    (0, swagger_1.ApiResponse)({ status: 200, type: [evolution_dto_1.EvolutionDto] }),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecordsController.prototype, "getEvolution", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecordsController.prototype, "getStats", null);
exports.RecordsController = RecordsController = __decorate([
    (0, common_1.Controller)('records'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard),
    __metadata("design:paramtypes", [create_clinical_record_use_case_1.CreateClinicalRecordUseCase,
        get_patient_evolution_use_case_1.GetPatientEvolutionUseCase,
        get_patient_stats_use_case_1.GetPatientStatsUseCase])
], RecordsController);
//# sourceMappingURL=records.controller.js.map