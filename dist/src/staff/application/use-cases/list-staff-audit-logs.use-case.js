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
exports.ListStaffAuditLogsUseCase = void 0;
const common_1 = require("@nestjs/common");
const staff_tokens_1 = require("../../staff.tokens");
let ListStaffAuditLogsUseCase = class ListStaffAuditLogsUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(tenantId) {
        return this.repository.findAuditLogsByTenant(tenantId);
    }
};
exports.ListStaffAuditLogsUseCase = ListStaffAuditLogsUseCase;
exports.ListStaffAuditLogsUseCase = ListStaffAuditLogsUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(staff_tokens_1.STAFF_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], ListStaffAuditLogsUseCase);
//# sourceMappingURL=list-staff-audit-logs.use-case.js.map