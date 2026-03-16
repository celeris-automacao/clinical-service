"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialModule = void 0;
const common_1 = require("@nestjs/common");
const create_social_post_use_case_1 = require("./application/use-cases/create-social-post.use-case");
const get_feed_use_case_1 = require("./application/use-cases/get-feed.use-case");
const social_controller_1 = require("./presentation/http/social.controller");
const social_listener_1 = require("./presentation/listeners/social.listener");
const prisma_social_repository_1 = require("./infrastructure/persistence/prisma-social.repository");
const social_tokens_1 = require("./social.tokens");
let SocialModule = class SocialModule {
};
exports.SocialModule = SocialModule;
exports.SocialModule = SocialModule = __decorate([
    (0, common_1.Module)({
        controllers: [social_controller_1.SocialController],
        providers: [
            get_feed_use_case_1.GetFeedUseCase,
            create_social_post_use_case_1.CreateSocialPostUseCase,
            social_listener_1.SocialListener,
            {
                provide: social_tokens_1.SOCIAL_REPOSITORY,
                useClass: prisma_social_repository_1.PrismaSocialRepository,
            },
        ],
    })
], SocialModule);
//# sourceMappingURL=social.module.js.map