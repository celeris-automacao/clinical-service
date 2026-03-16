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
exports.CreateTenantUseCase = void 0;
const common_1 = require("@nestjs/common");
const tenants_tokens_1 = require("../../tenants.tokens");
let CreateTenantUseCase = class CreateTenantUseCase {
    constructor(repository) {
        this.repository = repository;
    }
    async execute(createTenantDto) {
        return this.repository.create(createTenantDto);
    }
};
exports.CreateTenantUseCase = CreateTenantUseCase;
exports.CreateTenantUseCase = CreateTenantUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(tenants_tokens_1.TENANTS_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], CreateTenantUseCase);
//# sourceMappingURL=create-tenant.use-case.js.map