"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedInfrastructureModule = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_module_1 = require("../../prisma/prisma.module");
const shared_tokens_1 = require("../shared.tokens");
const nest_application_event_bus_adapter_1 = require("./events/nest-application-event-bus.adapter");
const prisma_tenant_plan_adapter_1 = require("./persistence/prisma-tenant-plan.adapter");
const tenant_scoped_prisma_factory_1 = require("./persistence/tenant-scoped-prisma.factory");
let SharedInfrastructureModule = class SharedInfrastructureModule {
};
exports.SharedInfrastructureModule = SharedInfrastructureModule;
exports.SharedInfrastructureModule = SharedInfrastructureModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [event_emitter_1.EventEmitterModule.forRoot(), prisma_module_1.PrismaModule],
        providers: [
            tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory,
            nest_application_event_bus_adapter_1.NestApplicationEventBusAdapter,
            {
                provide: shared_tokens_1.APPLICATION_EVENT_BUS,
                useExisting: nest_application_event_bus_adapter_1.NestApplicationEventBusAdapter,
            },
            {
                provide: shared_tokens_1.TENANT_PLAN_PORT,
                useClass: prisma_tenant_plan_adapter_1.PrismaTenantPlanAdapter,
            },
        ],
        exports: [prisma_module_1.PrismaModule, shared_tokens_1.APPLICATION_EVENT_BUS, shared_tokens_1.TENANT_PLAN_PORT, tenant_scoped_prisma_factory_1.TenantScopedPrismaFactory],
    })
], SharedInfrastructureModule);
//# sourceMappingURL=shared-infrastructure.module.js.map