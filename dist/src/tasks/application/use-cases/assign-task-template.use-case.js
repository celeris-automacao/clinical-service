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
exports.AssignTaskTemplateUseCase = void 0;
const common_1 = require("@nestjs/common");
const tasks_tokens_1 = require("../../tasks.tokens");
let AssignTaskTemplateUseCase = class AssignTaskTemplateUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(dto, tenantId, assignedByUserId) {
        const dueDate = this.parseLocalDate(dto.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) {
            throw new common_1.BadRequestException('A atribuicao nao pode ser criada com data no passado.');
        }
        const [template, patient] = await Promise.all([
            this.repository.findTemplateById(dto.templateId, tenantId),
            this.repository.findPatientById(dto.patientId, tenantId),
        ]);
        if (!template) {
            throw new common_1.NotFoundException('Template de tarefa nao encontrado.');
        }
        if (!template.isActive) {
            throw new common_1.BadRequestException('Nao e permitido atribuir um template inativo.');
        }
        if (!patient) {
            throw new common_1.NotFoundException('Paciente nao encontrado na clinica.');
        }
        const duplicate = await this.repository.findActiveAssignment({
            templateId: dto.templateId,
            patientId: dto.patientId,
            tenantId,
            dueDate,
        });
        if (duplicate) {
            throw new common_1.BadRequestException('Ja existe uma atribuicao ativa desse template para o paciente na data informada.');
        }
        return this.repository.createAssignment({
            templateId: dto.templateId,
            patientId: dto.patientId,
            tenantId,
            dueDate,
            assignedByUserId,
        });
    }
    parseLocalDate(input) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
        if (match) {
            const [, year, month, day] = match;
            return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
        }
        const parsed = new Date(input);
        parsed.setHours(0, 0, 0, 0);
        return parsed;
    }
};
exports.AssignTaskTemplateUseCase = AssignTaskTemplateUseCase;
exports.AssignTaskTemplateUseCase = AssignTaskTemplateUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(tasks_tokens_1.TASKS_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], AssignTaskTemplateUseCase);
//# sourceMappingURL=assign-task-template.use-case.js.map