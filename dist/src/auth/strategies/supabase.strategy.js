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
exports.SupabaseStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const map_supabase_user_use_case_1 = require("../application/use-cases/map-supabase-user.use-case");
const auth_tokens_1 = require("../auth.tokens");
let SupabaseStrategy = class SupabaseStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy, 'supabase') {
    constructor(authConfigPort, mapSupabaseUserUseCase) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: authConfigPort.getSupabaseJwtSecret(),
        });
        this.mapSupabaseUserUseCase = mapSupabaseUserUseCase;
    }
    async validate(payload) {
        return this.mapSupabaseUserUseCase.execute(payload);
    }
};
exports.SupabaseStrategy = SupabaseStrategy;
exports.SupabaseStrategy = SupabaseStrategy = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_tokens_1.AUTH_CONFIG_PORT)),
    __metadata("design:paramtypes", [Object, map_supabase_user_use_case_1.MapSupabaseUserUseCase])
], SupabaseStrategy);
//# sourceMappingURL=supabase.strategy.js.map