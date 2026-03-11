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
exports.TenantsService = void 0;
const common_1 = require("@nestjs/common");
let TenantsService = class TenantsService {
    constructor(tenantsRepository) {
        this.tenantsRepository = tenantsRepository;
    }
    async create(createTenantDto) {
        return this.tenantsRepository.create(createTenantDto);
    }
    async findAll() {
        return this.tenantsRepository.findAll();
    }
    async findOne(id) {
        const tenant = await this.tenantsRepository.findById(id);
        if (!tenant) {
            throw new common_1.NotFoundException(`Clínica com ID ${id} não encontrada.`);
        }
        return tenant;
    }
};
exports.TenantsService = TenantsService;
exports.TenantsService = TenantsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('ITenantsRepository')),
    __metadata("design:paramtypes", [Object])
], TenantsService);
//# sourceMappingURL=tenants.service.js.map