# INFRA-003A — Dockerfile da API

## Objetivo

Preparar uma imagem Docker de produção para `@workspace/api-server`, pronta para homologação no Easypanel, sem instalar dependências desnecessárias de frontend/mobile e sem embutir secrets.

## Remote e branch

- Remote: `https://github.com/celeris-company/modula-platform.git`
- Branch de deploy: `homolog`
- Dockerfile: `Dockerfile.api`
- Porta interna: `5000`

## Estratégia Docker

A imagem usa múltiplos stages:

```text
base
↓
dependencies
↓
builder
↓
runtime
```

Características:

- Node: `node:22-bookworm-slim`
- PNPM: `11.17.0` via Corepack
- Build path: raiz do monorepo
- Runtime: usuário não-root `node`
- Start: `node --enable-source-maps ./dist/index.mjs`
- Migrations copiadas para `/app/lib/db/migrations`

O runtime não chama `pnpm start`, porque o PNPM pode tentar reconciliar `node_modules` em ambiente não interativo. O container chama diretamente o comando efetivo do script de start.

## Workspace dependency isolation

O erro inicial era:

```text
ERR_PNPM_IGNORED_BUILDS
Ignored build scripts: core-js@3.49.0, esbuild@0.27.3
```

A causa raiz era a instalação ampla na raiz do monorepo:

```bash
pnpm install --frozen-lockfile
```

Esse comando instalava dependências de workspaces que não pertencem ao runtime da API, incluindo frontend/mobile.

## Dependências frontend excluídas

`core-js` entrava pela cadeia do frontend:

```text
@workspace/clinic-web
↓
jspdf
↓
canvg
↓
core-js
```

`core-js` não é dependência runtime nem build-time de `@workspace/api-server`.

Workspaces não necessários à imagem da API:

```text
@workspace/clinic-web
@workspace/clinic-mobile
@workspace/mockup-sandbox
@workspace/api-client-react
@workspace/api-spec
@workspace/integrations-openai-ai-react
@workspace/scripts
```

## Dependências API mantidas

A closure validada da API é:

```text
@workspace/api-server
├── @workspace/api-zod
├── @workspace/db
└── @workspace/integrations-openai-ai-server
```

O Dockerfile usa instalação filtrada oficial do PNPM 11:

```bash
pnpm --filter @workspace/api-server... install --frozen-lockfile
```

O seletor `@workspace/api-server...` inclui o projeto da API e suas dependências internas diretas/indiretas.

## Tratamento de esbuild

`esbuild` permanece porque é dependência de desenvolvimento real da API e executa o bundle em:

```text
artifacts/api-server/build.mjs
```

A política PNPM foi ajustada para permitir somente esse lifecycle script necessário:

```yaml
allowBuilds:
  esbuild: true
```

Não foi usado:

- `--dangerously-allow-all-builds`
- `--ignore-scripts` como solução cega
- downgrade de Node
- downgrade de PNPM
- alteração em dependências do frontend

O bloco antigo inválido foi removido:

```yaml
allowBuilds:
  core-js: set this to true or false
  esbuild: set this to true or false
```

## Produção e runtime

Após o build, o pacote de runtime é gerado por:

```bash
pnpm --filter @workspace/api-server --prod deploy --legacy /api-server
```

Antes de copiar para o stage final, o Dockerfile remove:

- `.env` e `.env.*`
- `src`
- `tsconfig.json`
- `vitest.config.ts`
- `build.mjs`
- `.tsbuildinfo`
- `.replit-artifact`

## Segurança

Validações da imagem final:

- sem `clinic-web`
- sem `clinic-mobile`
- sem `.env`
- sem `.git`
- sem fonte TypeScript da API
- usuário final `node`
- secrets somente em runtime via variáveis de ambiente

## Env vars de runtime

Obrigatórias ou esperadas conforme ambiente:

- `DATABASE_URL`
- `PORT`
- `NODE_ENV`
- `SESSION_SECRET`
- `CPF_LOOKUP_SECRET`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `ALLOWED_ORIGINS`
- `APP_URL`

Condicionais por funcionalidade:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `PUBLIC_OBJECT_SEARCH_PATHS`
- `PRIVATE_OBJECT_DIR`

## Health e readiness

Endpoints:

```text
GET /api/healthz
GET /api/ready
```

Em `NODE_ENV=production`, o middleware Clerk exige chaves com formato válido. A validação local usou placeholders sintáticos, sem registrar segredo real.

## Validação local concluída

```text
pnpm --filter @workspace/api-server typecheck: OK
pnpm --filter @workspace/api-server build: OK
docker build -f Dockerfile.api -t modula-api:staging .: OK
runtime container: OK
migrations em banco descartável: OK
GET /api/healthz: 200
GET /api/ready: 200
restart: OK
```

Imagem final observada:

```text
modula-api:staging — 505MB
```

## Easypanel

Configuração sugerida:

- Build type: `Dockerfile`
- Build path: `/`
- Dockerfile: `Dockerfile.api`
- Branch: `homolog`
- Repository: `celeris-company/modula-platform`
- Internal port: `5000`
- Health path: `/api/healthz`
- Readiness path: `/api/ready`

Não configurar domínio oficial nesta etapa.
Não executar seed.
Não embutir secrets no Dockerfile.
