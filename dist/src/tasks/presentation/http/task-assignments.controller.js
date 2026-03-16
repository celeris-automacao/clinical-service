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
exports.TaskAssignmentsController = void 0;
const common_1 = require("@nestjs/common");
const supabase_guard_1 = require("../../../auth/guards/supabase.guard");
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const roles_decorator_1 = require("../../../common/decorators/roles.decorator");
const roles_guard_1 = require("../../../common/guards/roles.guard");
const assign_task_template_use_case_1 = require("../../application/use-cases/assign-task-template.use-case");
const bulk_assign_task_template_use_case_1 = require("../../application/use-cases/bulk-assign-task-template.use-case");
const assign_task_template_dto_1 = require("./dto/assign-task-template.dto");
const bulk_assign_task_template_dto_1 = require("./dto/bulk-assign-task-template.dto");
let TaskAssignmentsController = class TaskAssignmentsController {
    constructor(assignTaskTemplateUseCase, bulkAssignTaskTemplateUseCase) {
        this.assignTaskTemplateUseCase = assignTaskTemplateUseCase;
        this.bulkAssignTaskTemplateUseCase = bulkAssignTaskTemplateUseCase;
    }
    assign(dto, user) {
        return this.assignTaskTemplateUseCase.execute(dto, user.tenantId, user.userId);
    }
    bulkAssign(dto, user) {
        return this.bulkAssignTaskTemplateUseCase.execute(dto, user.tenantId, user.userId);
    }
};
exports.TaskAssignmentsController = TaskAssignmentsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [assign_task_template_dto_1.AssignTaskTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], TaskAssignmentsController.prototype, "assign", null);
__decorate([
    (0, common_1.Post)('bulk'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_assign_task_template_dto_1.BulkAssignTaskTemplateDto, Object]),
    __metadata("design:returntype", void 0)
], TaskAssignmentsController.prototype, "bulkAssign", null);
exports.TaskAssignmentsController = TaskAssignmentsController = __decorate([
    (0, common_1.Controller)('task-assignments'),
    (0, common_1.UseGuards)(supabase_guard_1.SupabaseGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('owner', 'admin', 'doctor', 'specialist'),
    __metadata("design:paramtypes", [assign_task_template_use_case_1.AssignTaskTemplateUseCase,
        bulk_assign_task_template_use_case_1.BulkAssignTaskTemplateUseCase])
], TaskAssignmentsController);
//# sourceMappingURL=task-assignments.controller.js.map