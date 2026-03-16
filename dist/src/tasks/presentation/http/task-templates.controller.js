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
exports.TaskTemplatesController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const create_task_template_use_case_1 = require("../../application/use-cases/create-task-template.use-case");
const list_task_templates_use_case_1 = require("../../application/use-cases/list-task-templates.use-case");
const create_task_template_dto_1 = require("./dto/create-task-template.dto");
let TaskTemplatesController = class TaskTemplatesController {
    constructor(createTaskTemplateUseCase, listTaskTemplatesUseCase) {
        this.createTaskTemplateUseCase = createTaskTemplateUseCase;
        this.listTaskTemplatesUseCase = listTaskTemplatesUseCase;
    }
    create(dto, user) {
        return this.createTaskTemplateUseCase.execute(dto, user.tenantId, user.userId);
    }
    list(user) {
        return this.listTaskTemplatesUseCase.execute(user.tenantId);
    }
};
exports.TaskTemplatesController = TaskTemplatesController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_task_template_dto_1.CreateTaskTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], TaskTemplatesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TaskTemplatesController.prototype, "list", null);
exports.TaskTemplatesController = TaskTemplatesController = __decorate([
    (0, common_1.Controller)('task-templates'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('owner', 'admin', 'doctor', 'specialist'),
    __metadata("design:paramtypes", [create_task_template_use_case_1.CreateTaskTemplateUseCase,
        list_task_templates_use_case_1.ListTaskTemplatesUseCase])
], TaskTemplatesController);
//# sourceMappingURL=task-templates.controller.js.map