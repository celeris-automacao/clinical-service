"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsModule = void 0;
const common_1 = require("@nestjs/common");
const create_patient_use_case_1 = require("./application/use-cases/create-patient.use-case");
const get_patient_by_id_use_case_1 = require("./application/use-cases/get-patient-by-id.use-case");
const update_patient_profile_use_case_1 = require("./application/use-cases/update-patient-profile.use-case");
const patients_controller_1 = require("./presentation/http/patients.controller");
const prisma_patients_repository_1 = require("./infrastructure/persistence/prisma-patients.repository");
const patients_tokens_1 = require("./patients.tokens");
let PatientsModule = class PatientsModule {
};
exports.PatientsModule = PatientsModule;
exports.PatientsModule = PatientsModule = __decorate([
    (0, common_1.Module)({
        controllers: [patients_controller_1.PatientsController],
        providers: [
            create_patient_use_case_1.CreatePatientUseCase,
            get_patient_by_id_use_case_1.GetPatientByIdUseCase,
            update_patient_profile_use_case_1.UpdatePatientProfileUseCase,
            {
                provide: patients_tokens_1.PATIENTS_REPOSITORY,
                useClass: prisma_patients_repository_1.PrismaPatientsRepository,
            },
        ],
    })
], PatientsModule);
//# sourceMappingURL=patients.module.js.map