# Clinical Service

Backend NestJS do HealthQuest, um SaaS clínico com foco em:

- gestão multi-tenant por clínica
- cadastro e operação de pacientes e profissionais
- gamificação da jornada do paciente
- tarefas, evolução clínica, recompensas e feed social

## Objetivo do projeto

O projeto combina operação clínica com mecânicas de engajamento. A ideia central é transformar evolução de saúde em progressão gamificada, mantendo isolamento por clínica e regras operacionais reais de SaaS.

## Stack

- NestJS
- Prisma
- PostgreSQL
- JWT Bearer Auth
- Swagger
- Jest

## Execução local

Instalar dependências:

```bash
npm install
```

Aplicar migrations:

```bash
npx prisma migrate dev
npx prisma generate
```

Rodar seed:

```bash
npx prisma db seed
```

Subir a aplicação:

```bash
npm run start:dev
```

URLs:

- API: `http://localhost:3000/v1`
- Swagger: `http://localhost:3000/api`

## Testes automatizados

Rodar toda a suíte:

```bash
npx jest --runInBand
```

Checagem de TypeScript:

```bash
npx tsc --noEmit
```

## Testes manuais no Insomnia

Arquivos de apoio:

- Collection: [docs/insomnia/clinical-service-e2e.insomnia.json](/d:/Project%20HealthQuest/clinical-service/docs/insomnia/clinical-service-e2e.insomnia.json)
- Guia operacional: [docs/TESTES_INSOMNIA_E2E.md](/d:/Project%20HealthQuest/clinical-service/docs/TESTES_INSOMNIA_E2E.md)
- Gerador de token local: [generate-token.js](/d:/Project%20HealthQuest/clinical-service/generate-token.js)

Exemplos:

```bash
node generate-token.js owner
node generate-token.js staff
node generate-token.js patient
node generate-token.js owner --tenant <tenant_id>
```

## Arquitetura

O projeto foi reorganizado para um monólito modular com padrão:

- `presentation`
- `application`
- `domain`
- `infrastructure`

Fluxo principal:

- controller/listener
- use case
- port
- adapter/repository

Princípios aplicados:

- Clean Architecture leve
- Use Case pattern
- Repository pattern
- dependency inversion
- modularização por domínio
- multitenancy explícito

## Estrutura geral

Módulos principais em `src/`:

- `auth`
- `plans`
- `tenants`
- `staff`
- `patients`
- `records`
- `tasks`
- `rewards`
- `dashboard`
- `game`
- `social`
- `shared`
- `common`
- `prisma`

## Módulos e responsabilidades

### `plans`

Responsável pelo catálogo de planos do SaaS.

Funções principais:

- criar plano
- listar planos
- buscar plano por id

Regra de negócio:

- `code` do plano é único
- tenant só pode ser criado com plano existente e ativo
- plano define limites operacionais da clínica

### `tenants`

Responsável pelo onboarding e gestão da clínica.

Funções principais:

- criar tenant
- listar tenants
- buscar tenant por id
- alterar status operacional

Dados de negócio do tenant:

- nome comercial
- razão social
- CNPJ
- responsável
- plano
- status
- endereço institucional

Regra de negócio:

- `cnpj` é único
- tenant nasce vinculado a um plano
- tenant tem status operacional
- tenant possui endereço institucional
- criação do tenant inicializa boss da clínica

### `staff`

Responsável pela gestão dos profissionais da clínica.

Funções principais:

- criar profissional
- listar profissionais
- buscar profissional por id
- atualizar profissional
- alterar status
- convidar profissional
- aceitar convite
- revogar convite
- listar convites pendentes
- cleanup de convites expirados
- consultar contexto do profissional autenticado
- auditoria de alterações

Regra de negócio:

- `userId` é único por tenant
- `document` é único por tenant
- `email` é único por tenant
- `licenseNumber` é único por tenant
- não pode inativar o último `owner/admin` ativo
- convites têm status e expiração
- aceite de convite exige tenant compatível
- criação de staff respeita `maxStaff` do plano

### `patients`

Responsável pelo cadastro operacional e clínico básico do paciente.

Funções principais:

- criar paciente
- buscar paciente por id
- atualizar intake/profile clínico

Dados do paciente:

- nome
- email
- telefone
- documento
- gênero
- data de nascimento
- endereço
- profile clínico inicial

Regra de negócio:

- paciente pertence a um tenant
- leitura por id é tenant-aware
- criação respeita `maxPatients` do plano
- `supabaseId` do paciente precisa bater com o `sub` do token em fluxos autenticados

### `records`

Responsável pelo registro de evolução clínica do paciente.

Funções principais:

- criar record clínico
- buscar histórico de evolução
- consultar stats do paciente

Regra de negócio:

- record impacta a progressão do jogador
- evolução clínica gera dano no boss
- records podem disparar achievements de nível
- tudo é isolado por tenant

### `tasks`

Responsável pelo catálogo de tarefas da clínica e pelas atribuições ao paciente.

Modelo atual:

- `TaskTemplate`
- `TaskAssignment`

Funções principais:

- criar template de tarefa
- listar templates
- atribuir template a um paciente
- atribuir em lote
- listar tasks do paciente
- listar tasks de hoje
- completar task
- ranking de tarefas

Regra de negócio:

- template é reutilizável por clínica
- template é único por `tenant + title + taskType`
- assignment pertence a um paciente
- não pode duplicar assignment do mesmo template para o mesmo paciente na mesma data
- paciente só completa assignment próprio
- assignment não pode ser concluído duas vezes
- template inativo não pode ser atribuído

### `rewards`

Responsável por recompensas do jogo.

Funções principais:

- criar reward
- listar rewards disponíveis para o paciente
- claim de reward

Regra de negócio:

- criação administrativa só por `owner/admin`
- título é único por tenant
- reward depende de regras de desbloqueio
- claim não pode ser duplicado
- claim depende de elegibilidade do paciente

### `dashboard`

Responsável pela visão operacional da clínica.

Funções principais:

- overview da clínica
- pacientes inativos
- claims recentes

Regra de negócio:

- acesso restrito a perfis autorizados
- leituras são tenant-aware

### `game`

Responsável pela visão consolidada de progressão do jogador.

Funções principais:

- consultar stats do player

Dados expostos:

- level
- xp
- gold
- dano total
- streak

### `social`

Responsável pelo feed social interno.

Funções principais:

- listar feed do tenant
- criar posts sociais derivados de eventos

Regra de negócio:

- feed é isolado por tenant
- eventos do sistema podem gerar posts automaticamente

### `auth`

Responsável por autenticação JWT e montagem do contexto do usuário.

Funções principais:

- validar bearer token
- montar `UserContext`
- resolver contexto de staff por `userId + tenantId`

Regra de negócio:

- JWT sem `sub` ou sem `tenant_id` é rejeitado
- profissional inativo não autentica
- papel pode vir do cadastro de staff ou do token

### `shared`

Responsável por contratos e infraestrutura transversal.

Inclui:

- `UserContext`
- tokens compartilhados
- event bus de aplicação
- `TenantScopedPrismaFactory`
- helper de tenant scope
- porta para consulta de plano do tenant

## Regras de negócio centrais do sistema

### Multi-tenancy

- todo dado operacional pertence a um tenant
- consultas críticas usam contexto de tenant
- JWT precisa carregar `user_metadata.tenant_id`
- factories e repositories foram endurecidos para reduzir risco de vazamento entre clínicas

### Planos

- cada clínica opera em um plano
- plano define capacidade operacional
- limites ativos:
  - `maxStaff`
  - `maxPatients`

### Staff

- profissionais são geridos por clínica
- convite e aceite controlam onboarding do profissional
- auditoria registra mudanças críticas
- regras de papel governam autorização

### Paciente

- paciente pode ter endereço e profile clínico
- paciente participa da camada clínica e da gamificação

### Gamificação

- tasks geram XP e progressão
- evolução clínica gera dano
- rewards dependem de progresso
- game consolida stats do jogador
- social reflete eventos relevantes

## Modelo de dados

Principais entidades do schema Prisma:

- `Plan`
- `Tenant`
- `TenantAddress`
- `Staff`
- `StaffInvitation`
- `StaffAuditLog`
- `Patient`
- `PatientAddress`
- `PatientProfile`
- `ClinicalRecord`
- `TaskTemplate`
- `TaskAssignment`
- `Reward`
- `RewardClaim`
- `PlayerStats`
- `BossBattle`
- `SocialPost`

Arquivo base:

- [prisma/schema.prisma](/d:/Project%20HealthQuest/clinical-service/prisma/schema.prisma)

## Seed

O seed cria uma base mínima para desenvolvimento:

- plano inicial
- tenant inicial
- paciente inicial
- boss inicial
- templates de tarefa
- atribuições de tarefa
- rewards
- player stats

Arquivo:

- [prisma/seed.ts](/d:/Project%20HealthQuest/clinical-service/prisma/seed.ts)

## Convenções importantes

- autenticação via bearer token
- prefixo global da API: `/v1`
- DTOs ficam em `presentation/http/dto`
- repositórios Prisma ficam em `infrastructure/persistence`
- controllers e listeners não devem acessar Prisma diretamente

## Estado atual

O projeto já passou por uma refatoração estrutural importante. Hoje a base está preparada para:

- crescimento por módulo
- testes unitários amplos
- testes manuais ponta a ponta
- regras de negócio mais realistas para operação clínica

## Próximas evoluções naturais

- billing/subscription
- enforcement mais forte de limites por plano
- eventos com outbox/idempotência
- evolução de endereços e dados cadastrais adicionais
- expansão do domínio clínico e operacional
