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
exports.CreatePatientUseCase = void 0;
const common_1 = require("@nestjs/common");
const shared_tokens_1 = require("../../../shared/shared.tokens");
const patients_tokens_1 = require("../../patients.tokens");
let CreatePatientUseCase = class CreatePatientUseCase {
    constructor(repository, tenantPlanPort) {
        this.repository = repository;
        this.tenantPlanPort = tenantPlanPort;
    }
    async execute(createPatientDto, tenantId) {
        const [plan, currentPatients] = await Promise.all([
            this.tenantPlanPort.getTenantPlan(tenantId),
            this.repository.countByTenant(tenantId),
        ]);
        if (!plan) {
            throw new common_1.BadRequestException('Clinica sem plano ativo.');
        }
        if (currentPatients >= plan.maxPatients) {
            throw new common_1.BadRequestException('Limite de pacientes do plano atingido.');
        }
        return this.repository.createWithStats(createPatientDto, tenantId);
    }
};
exports.CreatePatientUseCase = CreatePatientUseCase;
exports.CreatePatientUseCase = CreatePatientUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(patients_tokens_1.PATIENTS_REPOSITORY)),
    __param(1, (0, common_1.Inject)(shared_tokens_1.TENANT_PLAN_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], CreatePatientUseCase);
//# sourceMappingURL=create-patient.use-case.js.map