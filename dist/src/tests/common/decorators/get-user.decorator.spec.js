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
const get_user_decorator_1 = require("../../../common/decorators/get-user.decorator");
const constants_1 = require("@nestjs/common/constants");
function getParamDecoratorFactory(decorator) {
    class Test {
        test(value) { }
    }
    __decorate([
        __param(0, decorator()),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", [Object]),
        __metadata("design:returntype", void 0)
    ], Test.prototype, "test", null);
    const args = Reflect.getMetadata(constants_1.ROUTE_ARGS_METADATA, Test, 'test');
    return args[Object.keys(args)[0]].factory;
}
describe('GetUser Decorator', () => {
    it('deve extrair o usuário do objeto request', () => {
        const factory = getParamDecoratorFactory(get_user_decorator_1.GetUser);
        const mockUser = { userId: '123', tenantId: '456', role: 'patient' };
        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => ({
                    user: mockUser,
                }),
            }),
        };
        const result = factory(null, mockContext);
        expect(result).toEqual(mockUser);
    });
});
//# sourceMappingURL=get-user.decorator.spec.js.map