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
exports.GetCategorizedRankingUseCase = void 0;
const common_1 = require("@nestjs/common");
const records_tokens_1 = require("../../../records/records.tokens");
const tasks_tokens_1 = require("../../tasks.tokens");
let GetCategorizedRankingUseCase = class GetCategorizedRankingUseCase {
    constructor(repository, recordsRepository) {
        this.repository = repository;
        this.recordsRepository = recordsRepository;
    }
    async execute(tenantId) {
        const [patients, clinicalDamageMap] = await Promise.all([
            this.repository.findPatientsWithActivity(tenantId),
            this.recordsRepository.getClinicalDamageByTenant(tenantId),
        ]);
        return patients
            .map((patient) => {
            const missionDamage = patient.taskAssignments.reduce((acc, assignment) => acc + (assignment.template?.xpReward || 0), 0);
            const clinicalDamage = clinicalDamageMap.get(patient.id) || 0;
            const totalDamage = missionDamage + clinicalDamage;
            return {
                name: patient.name,
                missionRank: missionDamage,
                clinicalRank: clinicalDamage,
                totalDamage,
                level: Math.floor(Math.sqrt(totalDamage / 500)) + 1,
            };
        })
            .sort((a, b) => b.totalDamage - a.totalDamage);
    }
};
exports.GetCategorizedRankingUseCase = GetCategorizedRankingUseCase;
exports.GetCategorizedRankingUseCase = GetCategorizedRankingUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(tasks_tokens_1.TASKS_REPOSITORY)),
    __param(1, (0, common_1.Inject)(records_tokens_1.RECORDS_REPOSITORY)),
    __metadata("design:paramtypes", [Object, Object])
], GetCategorizedRankingUseCase);
//# sourceMappingURL=get-categorized-ranking.use-case.js.map