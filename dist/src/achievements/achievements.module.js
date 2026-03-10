"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AchievementsModule = void 0;
const common_1 = require("@nestjs/common");
const achievements_service_1 = require("./achievements.service");
const achievements_repository_1 = require("./repositories/achievements.repository");
const common_2 = require("@nestjs/common");
const records_module_1 = require("../records/records.module");
let AchievementsModule = class AchievementsModule {
};
exports.AchievementsModule = AchievementsModule;
exports.AchievementsModule = AchievementsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_2.forwardRef)(() => records_module_1.RecordsModule),
        ],
        providers: [
            achievements_service_1.AchievementsService,
            {
                provide: 'IAchievementsRepository',
                useClass: achievements_repository_1.AchievementsRepository,
            },
        ],
        exports: [achievements_service_1.AchievementsService, 'IAchievementsRepository'],
    })
], AchievementsModule);
//# sourceMappingURL=achievements.module.js.map