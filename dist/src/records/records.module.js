"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordsModule = void 0;
const common_1 = require("@nestjs/common");
const records_controller_1 = require("./records.controller");
const records_repository_1 = require("./repositories/records.repository");
const records_service_1 = require("./records.service");
const game_module_1 = require("../game/game.module");
let RecordsModule = class RecordsModule {
};
exports.RecordsModule = RecordsModule;
exports.RecordsModule = RecordsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => game_module_1.GameModule),
        ],
        controllers: [records_controller_1.RecordsController],
        providers: [
            records_service_1.RecordsService,
            {
                provide: 'IRecordsRepository',
                useClass: records_repository_1.RecordsRepository,
            },
        ],
        exports: [records_service_1.RecordsService, 'IRecordsRepository'],
    })
], RecordsModule);
//# sourceMappingURL=records.module.js.map