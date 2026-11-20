# Modula Clinic

Monte sua clínica do seu jeito — plataforma clínica com web (médicos/gestores) e mobile (pacientes).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000/8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, interactive)
- `pnpm --filter @workspace/db run push-force` — push DB schema changes non-interactively (skips confirmation prompts)
- `pnpm --filter @workspace/db run migrate` — run pending migrations (non-interactive; use this in CI and before seeding)
- `pnpm --filter @workspace/scripts run seed` — seed test data (**automatically runs migrations first**)
- Required env: `DATABASE_URL` — Postgres connection string
- Private uploads default to `STORAGE_PROVIDER=disk`, with absolute `LOCAL_UPLOAD_DIR`
  and a stable `STORAGE_SIGNING_SECRET` (at least 32 characters). On EasyPanel,
  mount a private persistent volume writable by UID 1000. Select
  `STORAGE_PROVIDER=replit` explicitly to use the Replit sidecar.
  See [development deployment checklist](docs/DEPLOY_DEV.md).

### Homologação local abrangente

- Com o banco já migrado, execute `corepack pnpm --filter @workspace/scripts run seed:demo <clinicId> <ownerUserId> [AAAA-MM-DD]`.
- Exemplo: `corepack pnpm --filter @workspace/scripts run seed:demo 1 17 2026-10-30`. O proprietário deve existir e estar vinculado à clínica informada.
- Aceita somente `DATABASE_URL` com host loopback e recusa `NODE_ENV=production`. `APP_URL` deve ser HTTP local (padrão `http://127.0.0.1:5177`).
- Adiciona dados à clínica atual e cria Aurora e Horizonte com logotipos SVG, cores, serviços, equipe, galeria e páginas locais `/p/demo-aurora` e `/p/demo-horizonte`. Preserva a identidade e a publicação da clínica original.
- São dez pacientes, dois profissionais e uma secretária fictícios por clínica, com e-mails `@demo-test.invalid`, sem senhas, CPF, telefone, push token ou cartão real. O plano precisa ter vagas para os dois profissionais; o seed não altera planos existentes.
- Inclui aniversários de hoje/próximos dias; 14 dias de peso, água, alimentação, exercícios, check-ins e XP; metas, materiais, notas, questionários respondidos/pendentes, programas, contratos pendentes, leads, mensagens e comunidade.
- Agenda: dias úteis de 60 dias antes até 14 dias depois da referência, com consultas pagas, pendentes, canceladas, presenciais e teleconsultas, avaliações e comissões. Teleconsultas fictícias não têm sala real; lembretes das consultas criadas ficam marcados para não disparar notificações.
- Despesas em todas as categorias no mês de referência e nos dois meses anteriores. Os totais financeiros existentes passam a incluir esses lançamentos fictícios.
- Reexecuções com a mesma referência não duplicam os dados e preservam edições dos registros clínicos existentes. As datas de nascimento usam anos adultos e aniversários próximos à referência, inclusive na virada do mês.
- O seed regenera `artifacts/clinic-web/public/__local_demo__/billing.json` (ignorado pelo Git). Em `/billing`, apenas em Vite dev e host loopback, mostra próxima cobrança fictícia, Visa final 4242 e histórico simulado. Não há gateway, débito ou transação; alterar o plano não altera este exemplo. Sem esse arquivo, a seção fica desativada. O código da seção é excluído do JavaScript de produção; o manifesto também é removido do build e excluído do contexto Docker.
- O script insere diretamente no PostgreSQL em uma transação e não chama serviços de e-mail, WhatsApp, IA, pagamentos ou push. Não execute o seed principal para complementar esses dados: ele tem outra política de substituição de contas.

## Migrate → Seed runbook

After any schema change (`lib/db/src/schema/**`) the correct order is:

1. Generate a migration: `pnpm --filter @workspace/db run generate`
2. Apply it: `pnpm --filter @workspace/db run migrate`
3. Rebuild lib types: `pnpm run typecheck:libs`
4. Re-seed (optional): `pnpm --filter @workspace/scripts run seed`

The **seed script auto-migrates** at startup — running step 4 alone is safe even if you forgot step 2. The **API server also auto-migrates** on every startup, so development restarts always stay in sync with the latest migration files.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Auth: Clerk (web + API)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Web: React + Vite + Wouter + TanStack Query + Recharts
- Mobile: Expo (React Native) — patients only

## Where things live

- `artifacts/api-server/` — Express API (port 8080), serves `/api`
- `artifacts/clinic-web/` — React+Vite web cockpit for clinic staff, serves `/`
- `artifacts/clinic-mobile/` — Expo mobile app for patients
- `lib/db/` — Drizzle ORM schema + migrations
- `lib/api-spec/openapi.yaml` — Single source of truth for the API contract
- `lib/api-zod/` — Zod schemas generated from OpenAPI
- `lib/api-client-react/` — TanStack Query hooks generated from OpenAPI
- `artifacts/api-server/src/routes/` — All API route handlers

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval → TanStack hooks + Zod schemas. Never write hooks or schemas by hand.
- Three user roles: `patient` (own data only), `doctor` (assigned patients), `clinic_owner` (everything).
- XP gamification: 50XP per activity (exercise/water/nutrition), +50XP weekly bonus (all 3 goals × 7 days), +100XP monthly bonus.
- Clerk handles authentication for both web and API; mobile uses bearer token.
- DB schema uses `date` columns as strings (ISO format) — always convert `Date` objects with `.toISOString().split("T")[0]` before inserting.

## Product

- **Web cockpit** (`/`): Dashboard with clinic stats, patient list with search, patient detail with progress charts, check-in history, XP gamification, sabotage notes, doctors management, activity feed, public clinic promo page editor.
- **Mobile app**: Patient check-ins, weight entries, XP progress, sabotage notes, shortcut to the clinic's public promo page.
- **Public clinic page** (`/p/:slug`): Unauthenticated promo page per clinic (hero, about/mission, services, featured team, contact/hours/social) — content managed by `clinic_owner` at `/public-page`. All logged-in roles get a "Ver página pública" shortcut once published; the owner sees "Configurar página pública" until then.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Seed emails (reserved — do not use for real accounts)

The following emails are used exclusively by `scripts/src/seed.ts`. **Never create real user accounts with these addresses** — the seed's cleanup step will delete any data associated with them on the next run.

| Email | Role |
|---|---|
| carlos@gmail.com | clinic_owner (owns both KLIE and Vitalis Saúde) |
| maria@gmail.com | profissional_saude (KLIE) |
| eng.nayara@gmail.com | patient (KLIE) |
| ligia@clinica.dev | profissional_saude (KLIE) |
| carla@clinica.dev | profissional_saude (KLIE) |
| paula@clinica.dev | profissional_saude (KLIE) |
| admin@clinica.dev | (reserved) |
| secretaria@gmail.com | secretaria (KLIE) |
| ana@paciente.dev | patient (KLIE) |
| bruno@paciente.dev | patient (KLIE) |
| claudia@paciente.dev | patient (KLIE) |
| roberto@vitalis.dev | profissional_saude (Vitalis Saúde) |
| fernanda@vitalis.dev | profissional_saude (Vitalis Saúde) |
| juliano@vitalis.dev | profissional_saude (Vitalis Saúde) |
| marcelo@paciente.dev | patient (Vitalis Saúde) |
| patricia@paciente.dev | patient (Vitalis Saúde) |
| diego@paciente.dev | patient (Vitalis Saúde) |

`carlos@gmail.com` is linked to both clinics via `clinicOwnersTable` (multi-clinic owner). The web cockpit UI does not yet have a clinic switcher — see Gotchas below.

## Gotchas

- Clinic owners can already own multiple clinics in the schema (`clinicOwnersTable`), but the API's `resolveOwnerClinicId` (in `patients.ts` and similar) picks the **first** clinic row with `.limit(1)` when no `clinicId` is passed, and the web cockpit has no clinic switcher. A multi-clinic owner (e.g. seeded `carlos@gmail.com`) will only ever see one clinic's data until this is built.
- After changing `lib/db` schema, run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck`.
- DB `date` columns expect `string` (ISO format), not JS `Date` objects. Always convert with `.toISOString().split("T")[0]`.
- The `@workspace/db` lib needs to be compiled (`pnpm run typecheck:libs`) for API server to pick up new table exports.
- Clerk proxy is set up in the API server (`/clerk/` path) — the web app uses `VITE_CLERK_PROXY_URL`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
