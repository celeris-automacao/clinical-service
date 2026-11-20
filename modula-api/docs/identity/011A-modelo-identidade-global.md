# Story 011A — Modelo e governança da identidade global do paciente

## Estado do Git

- `git status --short` mostrou mudanças pré-existentes fora do escopo desta story.
- `git diff --check` exibiu apenas warnings já existentes nas alterações em andamento; nenhum novo problema foi introduzido por esta documentação.

## Inventário do modelo atual

### Identidade e autenticação

- `users` é a identidade base do sistema e já concentra autenticação, e-mail, senha, CPF e provedores externos.
- `patients` representa o paciente operacional por clínica/fluxo, não uma pessoa global pura.
- `doctors` e `secretaries` também são perfis derivados de `users`, com dados administrativos próprios.
- O login atual suporta `passwordHash`, `accessToken` legado, `clerkId` e fluxo temporário de senha.

### Vínculos com clínicas

- `patient_clinics` é a tabela de vínculo paciente-clínica.
- A chave primária é composta por `patient_id + clinic_id`.
- `clinic_owners` vincula usuários proprietários às clínicas.
- `doctors` e `secretaries` possuem `clinic_id` direto, representando afiliação local.

### Tratamentos e programas

- `care_packages` define o programa.
- `patient_packages` materializa a matrícula do paciente no programa dentro da clínica.
- `patient_package_doctors` vincula profissionais à matrícula.
- Há unique parcial para impedir duas matrículas `active` no mesmo trio `patient_id + package_id + clinic_id`.

### Operações clínicas principais

- `appointments`, `forms`, `form_assignments`, `form_responses`, `patient_notes`, `contracts`, `goals`, `messages`, `patient_materials`, `check_ins`, `weight_entries`, `water_entries`, `exercise_entries`, `calorie_entries`, `ai_patient_summaries` e `data_access_log` continuam apontando para `patients.id`.
- Isso reforça que o paciente operacional é local ao contexto da clínica, não global.

### CPF e unicidade

- `users.cpf` já existe com `unique`.
- `patients.cpf` já existe com unique parcial por clínica: `patients_clinic_cpf_unique`.
- `doctors.cpf` e `secretaries.cpf` existem sem unicidade explícita no schema atual.

## Respostas objetivas às 15 perguntas

1. `users` já representa uma identidade global? **Parcialmente sim**: é a melhor candidata atual, porque concentra auth, CPF e provedores, mas ainda mistura dados globais e papel local.
2. `patients` representa pessoa, paciente local ou ambos? **Paciente local** com dados clínicos e administrativos por clínica.
3. Existe um registro de paciente por clínica? **Sim**, via `patients` com `clinic_id` e via `patient_clinics`.
4. Existe uma tabela de vínculo paciente-clínica? **Sim**, `patient_clinics`.
5. Um mesmo `userId` pode estar em várias clínicas? **Sim**, especialmente em múltiplos papéis/vínculos; o schema permite isso por tabela de vínculo.
6. Um mesmo CPF pode existir em vários pacientes? **Sim, por enquanto** `patients.cpf` permite repetição entre clínicas diferentes; a unicidade é parcial por clínica, não global.
7. O CPF já existe no schema? **Sim**, em `users`, `patients`, `doctors` e `secretaries`.
8. Existe unique por CPF? **Sim, em `users.cpf`**; em `patients` a proteção é por `clinic_id + cpf`.
9. Existe unique por `userId + clinicId`? **Sim** em `patient_clinics` e `clinic_owners`; o vínculo staff-clínica usa PK composta.
10. Tratamentos apontam para `patientId`, `userId`, `clinicId` ou combinação? **Combinação**: `patient_packages` usa `patientId + packageId + clinicId`; vários recursos clínicos usam `patientId` com `clinicId` implícita pelo vínculo.
11. O backend resolve o contexto da clínica pela sessão? **Sim**, por JWT clinic-scoped, vínculo em `clinic_owners`, `doctors`, `secretaries` e consultas de escopo.
12. O frontend recebe algum identificador global indevido? **Não há evidência de exposição deliberada de identidade global**, mas o modelo atual ainda expõe IDs técnicos locais em várias rotas.
13. O mobile já consulta vínculos múltiplos? **Não como identidade global**; ele navega no contexto do usuário atual e do paciente operacional.
14. O login atual depende de paciente pré-cadastrado? **Em parte sim**: o fluxo de patient gira em torno de usuário/paciente já criado ou provisionado.
15. Existe conta provisória ou ainda não reivindicada? **Sim**, existe fluxo de senha temporária e ligação com `request-access`, indicando contas provisórias.

## Classificação dos campos

| Campo | Tabela atual | Global ou local | Quem pode alterar | Risco atual |
|---|---|---|---|---|
| CPF | `users`, `patients`, `doctors`, `secretaries` | Global em `users`; local/duplicado nas demais | Paciente, clínica em fluxos específicos | Duplicidade e enumeração |
| Nome | `users.name` | Global | Auth/owner/paciente em fluxos de conta | Mistura de nome civil e nome de exibição |
| Data de nascimento | `users.birth_date`, `patients.date_of_birth`, `doctors.birth_date`, `secretaries.birth_date` | Duplicado | Vários fluxos | Inconsistência entre cópias |
| E-mail | `users.email` | Global | Conta/auth | Risco baixo, mas usado como identificador único |
| Telefone | `users.phone`, `patients.phone`, `doctors.phone`, `secretaries.phone` | Ambíguo / duplicado | Paciente e clínica | Divergência entre contato global e local |
| Endereço | `patients.address_*` | Local da clínica | Clínica | Sem separação clara de local/global |
| Avatar | `users.avatar_url` | Global | Conta | Baixo risco |
| Senha | `users.password_hash` | Global | Paciente/conta | Centralizada corretamente |
| Status da conta | `users.deactivated_at`, `isTemporaryPassword`, `temporaryPasswordExpiresAt`, `deletionRequestedAt` | Global | Auth/admin | Requer governança forte |
| Status do vínculo | `patient_clinics` não tem status explícito | Não existe ainda | — | Lacuna do modelo |
| Prontuário | `patients` + tabelas clínicas | Local da clínica | Clínica | Adequado ao isolamento |
| Condições médicas | `patients.*Notes`, `medicalConditions` | Local da clínica | Clínica | Duplicação por contexto |
| Notas | `patient_notes`, `patient_materials`, `staff_events` | Local | Clínica | Adequado |
| Preferências | `users`/`patients` conforme fluxo | Ambíguo | Paciente | Falta de boundary formal |
| Lembretes | `patients` e mobile on-device | Local/paciente | Paciente | Separação boa, mas dispersa |
| Dados financeiros | `appointments`, `contracts`, `expenses`, `patient_packages` | Local da clínica | Clínica | Sem camada financeira global |
| Consentimentos | `consent_records`, `data_deletion_requests` | Global e auditável | Paciente/conta | Precisa amarração mais explícita |

## Estados necessários

### Conta global

- Já existem: `deactivatedAt`, `isTemporaryPassword`, `temporaryPasswordExpiresAt`, `deletionRequestedAt`.
- Divergência: não há enum explícito de `provisional`, `active`, `blocked`, `deleted`, `merged`.
- Reaproveitável: os campos atuais cobrem quase tudo, mas sem semântica formal.

### Vínculo paciente-clínica

- Já existe o vínculo, mas sem estado próprio.
- Falta: `pending`, `active`, `inactive`, `revoked`, `archived`.

### Tratamento

- Já existe `active`, `completed`, `cancelled` em `patient_packages`.
- Falta: `scheduled`, `paused` se o produto evoluir.

## Cenários A–G

### A — clínica cria a primeira identidade

- Modelo atual tende a criar `users` + `patients` + `patient_clinics` imediatamente.
- Falta separar “identidade provisória” de “vínculo local ativo”.

### B — paciente cria conta antes da clínica

- O sistema já suporta conta global com autenticação e depois vínculo local.
- Falta mecanismo de resolução por CPF para encadear o vínculo automaticamente.

### C — nova clínica encontra identidade existente

- Não há resolução global por CPF hoje.
- O design alvo deve reutilizar identidade global sem expor outras clínicas.

### D — retorno à clínica anterior

- A estrutura atual de tratamentos históricos já suporta novo `active` após `completed`.
- O vínculo paciente-clínica precisa ficar persistente e versionado.

### E — CPF duplicado por concorrência

- O `unique` global em `users.cpf` ajuda, mas não resolve a normalização nem o fluxo de merge.
- É necessário índice protegido e normalização de CPF.

### F — CPF incorreto

- Hoje não há fluxo formal de correção/merge.
- O desenho alvo precisa de auditoria e correção excepcional.

### G — login Google ou Apple

- Já existem campos para `appleUserId`, `clerkId` e email.
- Falta vínculo explícito entre provider e identidade global canônica.

## Ameaças e isolamento

| Risco | Impacto | Proteção necessária | Camada |
|---|---|---|---|
| Enumeração por CPF | Descoberta de identidade | Busca rate-limited, resposta opaca, hash/índice protegido | Backend + autenticação |
| Vazamento de outras clínicas | Quebra de sigilo | Escopo por clínica e não retorno de contagem global | Backend |
| Troca de `patientId` | Acesso indevido | Checagem de vínculo clínico em toda leitura | Backend |
| Troca de `clinicId` | Escopo errado | Derivar clínica efetiva da sessão | Backend |
| Correlação por `userId` | Identificação cruzada | Não expor IDs globais nas respostas de clínica | Frontend + backend |
| Atualização global indevida | Corrupção de identidade | Separar dados globais e locais com permissões distintas | Backend |
| Colisão/duplicidade de CPF | Identidade duplicada | Normalização + unique protegido + fluxo de merge | Banco + backend |
| E-mail/telefone malicioso | Sequestro de conta | Revalidação, auditoria e confirmação dupla | Autenticação + backend |
| Recuperação de senha | Tomada de conta | Token curto, uso único, auditoria | Auth |
| Conta provisória reivindicada por pessoa errada | Vazamento e fraude | Prova adicional antes de claim | Auth + backend |
| Merge incorreto | União de identidades erradas | Aprovação explícita + trilha de auditoria | Backend + auditoria |
| Funcionário acessando outra clínica | Violação de sigilo | Escopo rígido por vínculo/clinicId | RBAC + backend |

## Modelo alvo proposto

### 1. GlobalPerson

- `id`
- `cpf` normalizado e protegido
- `legalName`
- `birthDate`
- `primaryEmail`
- `primaryPhone`
- `status`
- `claimedAt`
- `createdAt`
- `updatedAt`

### 2. AuthIdentity

- `id`
- `globalPersonId`
- `provider`
- `providerSubject`
- `passwordHash` opcional
- `email`
- `verifiedAt`
- `createdAt`
- `updatedAt`

### 3. PatientClinicLink

- `id`
- `globalPersonId`
- `clinicId`
- `localPatientId`
- `status`
- `localEmail`
- `localPhone`
- `localAddress`
- `createdAt`
- `activatedAt`
- `deactivatedAt`

### 4. Treatment

- `id`
- `clinicId`
- `patientClinicLinkId`
- `packageId`
- `status`
- `startDate`
- `endDate`

### 5. IdentityAudit

- `id`
- `action`
- `actorUserId`
- `clinicId`
- `globalPersonId`
- `field`
- `reason`
- `createdAt`

## Política de atualização

### Clínica pode alterar diretamente

- dados locais
- prontuário
- tratamento
- contato local

### Clínica pode propor

- novo telefone global
- novo e-mail global
- correção de nome
- correção de data de nascimento

### Paciente pode alterar

- telefone global
- e-mail global
- preferências
- senha
- provedores de autenticação

### Fluxos excepcionais

- CPF
- merge
- correção de nascimento
- resolução de identidade duplicada

## Contrato conceitual de busca por CPF

### Quando não encontrado

```json
{
  "match": "not_found"
}
```

### Quando encontrado

```json
{
  "match": "found",
  "identity": {
    "status": "provisional | active | blocked",
    "canClaim": true
  }
}
```

### Quando há ambiguidade

```json
{
  "match": "ambiguous"
}
```

## Plano de migração futura

1. Introduzir `global_persons` sem quebrar `users`.
2. Migrar CPF normalizado para identidade global canônica.
3. Criar `auth_identities` para providers.
4. Criar `patient_clinic_links`.
5. Reapontar `patients` para o vínculo local.
6. Manter `users` como compat layer até a migração total.
7. Adicionar auditoria de merge/claim/correção.

## Compatibilidade

- O modelo atual é compatível com a evolução para identidade global, mas ainda mistura identidade, autenticação e vínculo local.
- A maior dívida é a ausência de entidade canônica global e de status formal do vínculo paciente-clínica.

## Decisões abertas

- `users` vira a identidade global canônica ou apenas o guarda-chuva de autenticação?
- CPF deve ser armazenado puro, normalizado, tokenizado ou hash parcial?
- `patients` será mantido como tabela local de vínculo ou como espelho parcial da identidade?
- Como operar merge sem expor clínicas externas?
- Qual o rito de claim para conta provisória?

## Observações finais

- Esta story é diagnóstica e proposicional.
- Nenhuma alteração de schema, migração ou dado foi feita.
- O inventário mostra que a base já possui os blocos principais, mas ainda não separa formalmente identidade global, vínculo local e autenticação.
