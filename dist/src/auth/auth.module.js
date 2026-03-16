"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const staff_module_1 = require("../staff/staff.module");
const map_supabase_user_use_case_1 = require("./application/use-cases/map-supabase-user.use-case");
const auth_tokens_1 = require("./auth.tokens");
const env_auth_config_adapter_1 = require("./infrastructure/adapters/env-auth-config.adapter");
const supabase_strategy_1 = require("./strategies/supabase.strategy");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [passport_1.PassportModule.register({ defaultStrategy: 'supabase' }), staff_module_1.StaffModule],
        providers: [
            map_supabase_user_use_case_1.MapSupabaseUserUseCase,
            {
                provide: auth_tokens_1.AUTH_CONFIG_PORT,
                useClass: env_auth_config_adapter_1.EnvAuthConfigAdapter,
            },
            supabase_strategy_1.SupabaseStrategy,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map