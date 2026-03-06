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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRecordDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateRecordDto {
}
exports.CreateRecordDto = CreateRecordDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(20),
    (0, class_validator_1.Max)(300),
    (0, swagger_1.ApiProperty)({ example: 83.5, description: 'Peso atual do paciente em kg' }),
    __metadata("design:type", Number)
], CreateRecordDto.prototype, "weight", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiPropertyOptional)({ example: 32.1, description: 'Massa muscular esquelética' }),
    __metadata("design:type", Number)
], CreateRecordDto.prototype, "skeletal_muscle_mass", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiPropertyOptional)({ example: 18.5, description: 'Massa de gordura corporal' }),
    __metadata("design:type", Number)
], CreateRecordDto.prototype, "body_fat_mass", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiPropertyOptional)({ example: 22.5, description: 'Percentual de gordura corporal' }),
    __metadata("design:type", Number)
], CreateRecordDto.prototype, "percent_body_fat", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiPropertyOptional)({ example: 9, description: 'Nível de gordura visceral' }),
    __metadata("design:type", Number)
], CreateRecordDto.prototype, "visceral_fat_level", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, swagger_1.ApiPropertyOptional)({ example: 1850, description: 'Taxa metabólica basal (kcal)' }),
    __metadata("design:type", Number)
], CreateRecordDto.prototype, "basal_metabolic_rate", void 0);
//# sourceMappingURL=create-record.dto.js.map