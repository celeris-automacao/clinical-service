# INFRA-004A — Dockerizacao do clinic-web

## Objetivo

Preparar o `clinic-web` para deploy em producao/staging via Easypanel usando imagem Docker propria, sem alterar regras de negocio, banco, backend ou mobile.

## Arquitetura adotada

O frontend web continua usando o contrato atual do projeto: chamadas para API via caminho relativo `/api` no mesmo origin da aplicacao web.

```text
Browser
  ↓
clinic-web container (Nginx, porta 8080)
  ↓ /api/*
API upstream configuravel por API_UPSTREAM
```

Motivos:

- o client gerado usa URLs relativas `/api/...`;
- os fluxos de autenticacao e sessao continuam same-origin;
- hooks com EventSource tambem usam `/api/...`;
- evita expor uma URL de API hardcoded no bundle Vite;
- permite trocar o upstream no Easypanel sem rebuild da imagem.

## Arquivos criados

- `Dockerfile.web`
- `infra/nginx/clinic-web.conf.template`

## Arquivos ajustados

- `.dockerignore`: permite incluir `Dockerfile.web` no contexto Docker.
- `pnpm-workspace.yaml`: adiciona `core-js` em `allowBuilds` porque ele pertence ao grafo real do `clinic-web` via `jspdf` e o PNPM 11 bloqueia scripts nao aprovados.

A liberacao foi explicita e minima. Nao foi usado `--dangerously-allow-all-builds`.

## Dockerfile

A imagem usa tres estagios:

1. `base`: Node 22 slim com PNPM 11.17.0 via Corepack.
2. `dependencies`/`builder`: instala apenas o grafo do `@workspace/clinic-web...` e executa o build Vite.
3. `runtime`: `nginxinc/nginx-unprivileged:1.27-alpine` servindo somente `dist/public`.

Porta interna do container:

```text
8080
```

Comando validado:

```powershell
docker build -f Dockerfile.web -t modula-web:staging .
```

## Build do Vite

O build do `clinic-web` exige `PORT` por configuracao atual do `vite.config.ts`.

No Dockerfile:

```text
PORT=4173
```

Output estatico:

```text
artifacts/clinic-web/dist/public
```

## Variaveis de ambiente

### Runtime

| Variavel | Obrigatoria | Finalidade | Valor validado |
| --- | --- | --- | --- |
| `API_UPSTREAM` | Opcional com default | Define o destino do proxy `/api/` no Nginx | `https://modula-staging-modula-api.tzozw2.easypanel.host` |

Em Easypanel, se houver hostname interno confiavel entre servicos, `API_UPSTREAM` pode ser trocado para esse endpoint sem rebuild.

### Build time

| Variavel | Obrigatoria | Finalidade |
| --- | --- | --- |
| `PORT` | Sim no build atual | Necessaria para o `vite.config.ts`; fixada como `4173` no Dockerfile |
| `BASE_PATH` | Nao | Permite publicar em subpath; default `/` |
| `REPLIT_EXPO_DEV_DOMAIN` | Nao | Alimenta `VITE_EXPO_DEV_DOMAIN` em ambiente Replit/dev |

Nenhum segredo foi adicionado ao bundle.

## Nginx

Configuracoes principais:

- SPA fallback com `try_files $uri $uri/ /index.html`;
- cache imutavel para `/assets/`;
- bloqueio de arquivos ocultos;
- headers basicos de seguranca;
- proxy `/api/` para `API_UPSTREAM`;
- `proxy_buffering off` e `proxy_read_timeout 1h` para SSE/streams;
- runtime unprivileged, usuario `101`.

## Validacoes executadas

### Web local

```powershell
pnpm --filter @workspace/clinic-web typecheck
$env:PORT='4173'; pnpm --filter @workspace/clinic-web build
pnpm --dir artifacts/clinic-web exec vitest run src/App.dashboard-route.test.tsx src/App.finance-route.test.tsx src/App.secretary-route.test.tsx
```

Resultado:

- typecheck OK;
- build OK;
- 3 arquivos de teste OK;
- 7 testes OK.

### Docker

```powershell
docker build --progress=plain -f Dockerfile.web -t modula-web:staging .
docker run -d --name modula-web-staging-test -p 8090:8080 modula-web:staging
```

Resultado:

- imagem criada: `modula-web:staging`;
- tamanho observado: `76.8MB`;
- usuario runtime: `101`;
- container iniciou com sucesso.

### Rotas testadas no container

```text
/              200 text/html
/login         200 text/html
/dashboard     200 text/html
/finance       200 text/html
/api/healthz   200 application/json
/api/ready     200 application/json
```

### Artefatos sensiveis

Verificado dentro do container:

- nenhum `.env` encontrado;
- nenhum `.env.*` encontrado;
- nenhum `.git` encontrado;
- nenhum sourcemap `*.map` encontrado.

## Warnings nao bloqueadores

Durante o build Vite aparecem warnings de sourcemap em componentes UI e aviso de chunk acima de 500 kB.

Classificacao:

- nao bloqueiam o build;
- nao foram introduzidos como regra de negocio;
- devem ser tratados em otimizacao futura de frontend, se necessario.

## Configuracao sugerida no Easypanel

- Dockerfile: `Dockerfile.web`
- Porta interna: `8080`
- Healthcheck web: `/`
- Healthcheck de integracao API, se desejado: `/api/healthz`
- Variavel runtime:

```text
API_UPSTREAM=https://modula-staging-modula-api.tzozw2.easypanel.host
```

Nao configurar segredos no frontend sem necessidade. Variaveis `VITE_*` ficam embutidas no bundle e devem ser tratadas como publicas.

## Estado final esperado

A imagem web esta pronta para deploy no Easypanel, desde que a API de staging esteja acessivel pelo valor configurado em `API_UPSTREAM`.
