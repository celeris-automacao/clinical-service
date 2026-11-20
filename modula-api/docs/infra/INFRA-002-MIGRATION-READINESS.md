# INFRA-002 — Sanidade de migrations e contrato de deploy

## 1. Diagnóstico

A cadeia de migrations do Modula Platform usa Drizzle e deve ser capaz de reconstruir um PostgreSQL vazio antes que a API de staging seja conectada ao banco `modula-db` no Easypanel.

Resultado final da auditoria:

- ORM: Drizzle ORM.
- Runner: `lib/db/src/migrate.ts`.
- Comando oficial: `pnpm --filter @workspace/db run migrate`.
- Tabela de controle: `drizzle.__drizzle_migrations`.
- Banco vazio local reconstruído com sucesso.
- Schema reconstruído idêntico ao schema público do banco local atual.
- Seed permanece separada e não participa do deploy.
- Nenhuma migration foi executada na VPS.

Classificação final:

```text
READY FOR STAGING MIGRATION
```
## 2. Estado Git inicial

Comandos executados:

```bash
git status --short
git diff --check
git branch --show-current
git log -1 --oneline
```

Estado observado:

- Branch: `feature/ux_mobile`
- Último commit: `604b798 feat(ux): introduce daily mission experience`
- Staging: limpo
- Alteração pré-existente preservada: `docs/infra/` não rastreado da INFRA-001
- `git diff --check`: limpo

## 3. Inventário das migrations

Antes da correção:

- Arquivos SQL: `61`
- Entradas no journal: `60`
- SQL fora do journal: `0043_friendly_frightful_four.sql`
- Entradas no journal sem SQL: nenhuma
- Número duplicado: `0043`

Depois da correção:

- Arquivos SQL: `60`
- Entradas no journal: `60`
- SQL fora do journal: nenhum
- Entradas no journal sem SQL: nenhuma
- Número duplicado: nenhum

Tabela resumida da cadeia final:

| Ordem | SQL | Journal | Finalidade resumida |
|---:|---|---|---|
| 0 | `0000_spooky_goblin_queen.sql` | sim | baseline inicial do schema |
| 1 | `0001_add_nutrition_columns.sql` | sim | campos nutricionais |
| 2 | `0002_add_password_reset_tokens.sql` | sim | reset de senha |
| 3 | `0003_add_birthday_notification_year.sql` | sim | controle de aniversário |
| 4 | `0004_add_clinics.sql` | sim | clínicas |
| 5 | `0005_add_multitenant.sql` | sim | multiclínica |
| 6 | `0006_fix_patient_doctors_fk.sql` | sim | FK paciente/profissional |
| 7 | `0007_add_super_admin_role.sql` | sim | role super admin |
| 8 | `0008_allow_multi_clinic_owners.sql` | sim | donos multiclínica |
| 9 | `0009_vengeful_shaman.sql` | sim | evolução de schema |
| 10 | `0010_add_calorie_macros_checkin_nullable.sql` | sim | check-ins nutricionais nullable |
| 11 | `0011_past_mulholland_black.sql` | sim | evolução de schema |
| 12 | `0012_stale_squadron_sinister.sql` | sim | evolução de schema |
| 13 | `0013_add_chat_conversations_messages.sql` | sim | conversas e mensagens |
| 14 | `0014_abnormal_starhawk.sql` | sim | evolução de schema |
| 15 | `0015_curly_hairball.sql` | sim | evolução de schema |
| 16 | `0016_small_mephistopheles.sql` | sim | evolução de schema |
| 17 | `0017_tearful_boomerang.sql` | sim | evolução de schema |
| 18 | `0018_furry_wolverine.sql` | sim | evolução de schema |
| 19 | `0019_white_epoch.sql` | sim | evolução de schema |
| 20 | `0020_worthless_thunderbolts.sql` | sim | evolução de schema |
| 21 | `0021_rich_tiger_shark.sql` | sim | evolução de schema |
| 22 | `0022_dusty_stone_men.sql` | sim | evolução de schema |
| 23 | `0023_last_sheva_callister.sql` | sim | evolução de schema |
| 24 | `0024_purple_runaways.sql` | sim | evolução de schema |
| 25 | `0025_cold_the_fury.sql` | sim | evolução de schema |
| 26 | `0026_fine_deadpool.sql` | sim | evolução de schema |
| 27 | `0027_tricky_stellaris.sql` | sim | evolução de schema |
| 28 | `0028_closed_ravenous.sql` | sim | evolução de schema |
| 29 | `0029_common_arachne.sql` | sim | evolução de schema |
| 30 | `0030_outstanding_rage.sql` | sim | evolução de schema |
| 31 | `0031_black_dreadnoughts.sql` | sim | evolução de schema |
| 32 | `0032_productive_purifiers.sql` | sim | evolução de schema |
| 33 | `0033_lonely_big_bertha.sql` | sim | evolução de schema |
| 34 | `0034_young_lord_hawal.sql` | sim | evolução de schema |
| 35 | `0035_next_stephen_strange.sql` | sim | evolução de schema |
| 36 | `0036_uneven_wildside.sql` | sim | evolução de schema |
| 37 | `0037_breezy_baron_strucker.sql` | sim | evolução de schema |
| 38 | `0038_early_black_knight.sql` | sim | evolução de schema |
| 39 | `0039_thankful_mauler.sql` | sim | evolução de schema |
| 40 | `0040_tricky_mephistopheles.sql` | sim | evolução de schema |
| 41 | `0041_calm_wonder_man.sql` | sim | evolução de schema |
| 42 | `0042_married_bullseye.sql` | sim | evolução de schema |
| 43 | `0043_condemned_galactus.sql` | sim | `patients.clinic_id` e índice único parcial por clínica/CPF |
| 44 | `0044_common_christian_walker.sql` | sim | evolução de schema |
| 45 | `0045_friendly_frightful_four.sql` | sim | LGPD, refresh tokens e colunas de segurança em `users` |
| 46 | `0046_gray_wiccan.sql` | sim | evolução de schema |
| 47 | `0047_brave_the_captain.sql` | sim | evolução de schema |
| 48 | `0048_clean_kronos.sql` | sim | evolução de schema |
| 49 | `0049_organic_king_cobra.sql` | sim | evolução de schema |
| 50 | `0050_yummy_rick_jones.sql` | sim | evolução de schema |
| 51 | `0051_strong_silverclaw.sql` | sim | evolução de schema |
| 52 | `0052_serious_spitfire.sql` | sim | evolução de schema |
| 53 | `0053_milky_brood.sql` | sim | evolução de schema |
| 54 | `0054_faithful_landau.sql` | sim | evolução de schema |
| 55 | `0055_plain_stick.sql` | sim | evolução de schema |
| 56 | `0056_peaceful_mentor.sql` | sim | evolução de schema |
| 57 | `0057_living_starfox.sql` | sim | evolução de schema |
| 58 | `0058_cold_blue_shield.sql` | sim | identidade global por CPF |
| 59 | `0059_active_enrollment_unique_index.sql` | sim | índice único parcial de matrícula ativa |

## 4. Migration órfã

Migration órfã removida:

```text
lib/db/migrations/0043_friendly_frightful_four.sql
```

Ela fazia:

- `CREATE TABLE "consent_records"`
- `CREATE TABLE "data_deletion_requests"`
- `CREATE TABLE "data_access_log"`
- `CREATE TABLE "refresh_tokens"`
- `ALTER TABLE "users" ADD COLUMN "failed_login_count"`
- `ALTER TABLE "users" ADD COLUMN "last_failed_login_at"`
- `ALTER TABLE "users" ADD COLUMN "deletion_requested_at"`
- criação de FKs para as tabelas acima
- unique em `refresh_tokens.token_hash`

Problemas encontrados:

- O arquivo não estava no journal.
- O número `0043` colidia com `0043_condemned_galactus.sql`.
- O Drizzle migrator não executava esse arquivo em banco novo.
- A mesma intenção foi substituída pela migration oficial `0045_friendly_frightful_four.sql`.

Evidência de substituição:

- `0045_friendly_frightful_four.sql` cria as mesmas tabelas e colunas.
- `0045` usa `IF NOT EXISTS` e blocos `DO $$ ... duplicate_object ... $$`, tornando a migration segura em ambientes que já tinham parte da estrutura.
- `0045` está no journal com `idx: 45`.
- O banco vazio reconstruído possui as tabelas e colunas esperadas sem precisar da órfã.

Decisão:

```text
B. migration é redundante e não deve executar
```

A correção mínima foi remover o SQL órfão que não participava da cadeia oficial.

## 5. Motivo da divergência

A divergência existia porque uma versão inicial de migration LGPD/auth foi deixada no diretório como arquivo SQL, mas não foi registrada no journal Drizzle.

Provável sequência:

```text
0043_friendly_frightful_four.sql
↓
substituída por versão idempotente
↓
0045_friendly_frightful_four.sql registrada no journal
↓
arquivo antigo permaneceu no diretório
```

Impacto antes da correção:

- Banco novo era reconstruído corretamente.
- Porém o runner emitia warning:

```text
__drizzle_migrations has 60 entries but 61 SQL files exist
```

Impacto depois da correção:

- Banco novo reconstrói corretamente.
- Contagem final: `60/60 migrations tracked`.
- Warning removido.

## 6. Runner

Arquivo:

```text
lib/db/src/migrate.ts
```

Comportamento:

1. Exige `DATABASE_URL`.
2. Determina a pasta de migrations.
3. Cria pool PostgreSQL.
4. Executa `stampBaselineIfNeeded`.
5. Loga migrations pendentes a partir do journal.
6. Executa `migrate(db, { migrationsFolder })`.
7. Verifica contagem de migrations.
8. Verifica se todas as tabelas exportadas no schema Drizzle existem no banco.
9. Finaliza pool.

Tabela de controle:

```text
drizzle.__drizzle_migrations
```

O que controla execução:

- O migrator da Drizzle usa o journal em `meta/_journal.json`.
- SQL fora do journal não é executado.
- A decisão de pendência considera `when` maior que o último `created_at` registrado.

Comportamento com banco vazio:

- Não carimba baseline.
- Executa todas as entries do journal.

Comportamento se migration falhar:

- O comando retorna exit code diferente de zero.
- A API, quando chama migration no startup, aborta o startup.

Resposta objetiva:

```text
0043_friendly_frightful_four.sql seria ignorada em banco novo.
```

## 7. Banco vazio

Banco descartável local:

```text
modula_migration_test_codex
```

Comandos usados:

```powershell
docker exec modula-clinic-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 `
  -c "DROP DATABASE IF EXISTS modula_migration_test_codex;" `
  -c "CREATE DATABASE modula_migration_test_codex;"

$env:DATABASE_URL='postgresql://postgres:postgrespassword@localhost:5435/modula_migration_test_codex'
pnpm --filter @workspace/db run migrate
```

Resultado após correção:

- `60` migrations pendentes aplicadas.
- `60/60 migrations tracked`.
- `56` tabelas do schema Drizzle verificadas.
- Sem warning de contagem.
- Comando repetido em banco atualizado retornou `No pending migrations — database is up to date`.

Banco descartável removido ao final:

```powershell
docker exec modula-clinic-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 `
  -c "DROP DATABASE IF EXISTS modula_migration_test_codex;"
```

## 8. Comparação de schema

Comparados:

- A) banco local atual `modula_clinic`
- B) banco reconstruído do zero `modula_migration_test_codex`
- C) schema Drizzle atual via verificação de tabelas do runner

Validações executadas:

- contagem de tabelas públicas;
- dump schema-only com `pg_dump`;
- comparação normalizada removendo apenas ruído `\restrict`/`\unrestrict`;
- verificação interna do runner para tabelas exportadas por `pgTable`;
- estruturas afetadas pela órfã.

Resultado:

- Tabelas públicas local: `56`
- Tabelas públicas reconstruídas: `56`
- Migrations rastreadas reconstruídas: `60`
- Diferença de schema público normalizada: nenhuma

Classificação:

```text
IDÊNTICOS
```

## 9. Startup migrations

Fluxo atual da API:

```text
API start
↓
migrateDb()
↓
server listen
```

Arquivo:

```text
artifacts/api-server/src/index.ts
```

Avaliação:

- Migration com erro impede a API de subir.
- Isso é bom para fail-fast.
- Não foi identificado lock explícito de aplicação no runner.
- A Drizzle usa tabela de controle, mas isso não substitui um contrato operacional de migration job em ambientes com múltiplas réplicas.

Staging:

- Aceitável para uma única instância.

Produção:

- Preferir migration job/release command antes do start da API.

Contrato futuro recomendado:

```text
deploy
↓
pnpm --filter @workspace/db run migrate
↓
sucesso
↓
pnpm --filter @workspace/api-server start
```

Nesta story, o auto-migrate no startup não foi removido.

## 10. Comando oficial

Comando oficial definido:

```bash
pnpm --filter @workspace/db run migrate
```

Propriedades:

- usa `DATABASE_URL`;
- retorna exit code diferente de zero em erro;
- não executa seed;
- pode rodar em CI/Easypanel;
- é seguro em banco já atualizado;
- usa o runner oficial do projeto.

String conceitual de `DATABASE_URL`:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

Não colocar credenciais reais em documentação ou repositório.

## 11. Estratégia de deploy Easypanel

Fluxo recomendado para banco vazio de staging:

```text
PostgreSQL vazio
↓
pnpm install --frozen-lockfile
↓
pnpm --filter @workspace/api-server build
↓
pnpm --filter @workspace/db run migrate
↓
validar / schema / logs
↓
pnpm --filter @workspace/api-server start
```

Observações:

- A pasta `lib/db/migrations` precisa estar presente no ambiente de runtime.
- Seed não faz parte do fluxo.
- Não executar migrations na VPS antes de concluir as validações locais.

Critérios para usar `modula-db` na VPS:

1. cadeia de migrations íntegra;
2. reconstrução local a partir do zero aprovada;
3. schema reconstruído igual ao schema atual;
4. comando oficial definido;
5. rollback documentado;
6. seed separado.

Status:

```text
CRITÉRIOS ATENDIDOS LOCALMENTE
```

## 12. Rollback

O projeto não possui down migrations versionadas.

Rollback recomendado para staging antes do primeiro uso real:

1. snapshot/backup do banco antes da migration;
2. executar `pnpm --filter @workspace/db run migrate`;
3. se falhar, descartar o banco vazio de staging e recriar;
4. se houver dados, restaurar snapshot;
5. não rodar seed para tentar reparar schema.

Rollback recomendado para produção futura:

- backup verificado antes da migration;
- migration job separado do start;
- janela de manutenção quando houver alteração destrutiva;
- plano de restore testado.

## 13. Seed

Seeds permanecem totalmente separadas.

Comandos existentes:

```bash
pnpm --filter @workspace/scripts seed
pnpm --filter @workspace/scripts seed:birthdays-and-agenda
```

Decisão:

- Não executar seed no deploy.
- Não executar seed na VPS.
- Usar apenas em banco descartável de QA/dev quando necessário.

## 14. Arquivos alterados

Alterados nesta story:

- `lib/db/migrations/0043_friendly_frightful_four.sql`
- `docs/infra/INFRA-002-MIGRATION-READINESS.md`

Tipo de alteração:

- remoção de SQL órfão fora do journal;
- criação de documentação técnica de readiness.

Arquivos preservados:

- código de produção;
- frontend web;
- mobile;
- seeds;
- schema Drizzle;
- migrations antigas oficiais;
- VPS/staging database.

## 15. Validações executadas

Comandos de diagnóstico:

```bash
git status --short
git diff --check
git branch --show-current
git log -1 --oneline
```

Inventário:

- contagem SQL versus journal;
- identificação de duplicidade `0043`;
- comparação SQL/journal;
- leitura de `lib/db/src/migrate.ts`;
- inspeção da migration órfã;
- comparação com `0045_friendly_frightful_four.sql`;
- consulta de metadados do banco local.

Banco vazio:

- criação de `modula_migration_test_codex`;
- execução de `pnpm --filter @workspace/db run migrate`;
- reexecução idempotente;
- comparação de schema;
- remoção do banco descartável.

Validações técnicas finais:

- `pnpm --filter @workspace/api-server typecheck`
- `pnpm --filter @workspace/api-server build`
- `pnpm --filter @workspace/db run migrate` em banco descartável
- `git diff --check`

## 16. Decisão final

A migration órfã era redundante, não oficial e ignorada pelo runner.

A cadeia oficial agora está reconciliada:

```text
60 SQL files
60 journal entries
0 orphan SQL
0 missing SQL
0 duplicated migration numbers
```

O banco vazio local chega ao schema esperado exclusivamente pelas migrations versionadas.

Classificação:

```text
READY FOR STAGING MIGRATION
```
