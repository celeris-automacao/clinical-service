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
exports.CreateTaskUseCase = void 0;
const common_1 = require("@nestjs/common");
const tasks_tokens_1 = require("../../tasks.tokens");
let CreateTaskUseCase = class CreateTaskUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(dto, tenantId) {
        const dueDate = new Date(dto.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) {
            throw new common_1.BadRequestException('A tarefa nao pode ser criada com data no passado.');
        }
        const patient = await this.repository.findPatientById(dto.patientId, tenantId);
        if (!patient) {
            throw new common_1.NotFoundException('Paciente nao encontrado na clinica.');
        }
        const duplicateTask = await this.repository.findDuplicateActiveTask({
            patientId: dto.patientId,
            tenantId,
            taskType: dto.taskType,
            dueDate,
            title: dto.title,
        });
        if (duplicateTask) {
            throw new common_1.BadRequestException('Ja existe uma tarefa ativa semelhante para este paciente na data informada.');
        }
        return this.repository.create({
            ...dto,
            dueDate,
            tenantId,
        });
    }
};
exports.CreateTaskUseCase = CreateTaskUseCase;
exports.CreateTaskUseCase = CreateTaskUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(tasks_tokens_1.TASKS_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], CreateTaskUseCase);
//# sourceMappingURL=create-task.use-case.js.map