# Testes E2E no Insomnia

Este guia descreve o fluxo manual de testes da API usando o Insomnia, request por request.

## Pré-requisitos

1. Instalar dependências:

```bash
npm install
```

2. Garantir banco e migrations aplicadas:

```bash
npx prisma migrate dev
npx prisma generate
```

3. Subir a API:

```bash
npm run start:dev
```

4. Conferir URLs:

- API: `http://localhost:3000/v1`
- Swagger: `http://localhost:3000/api`

## Collection do Insomnia

Importe a collection:

- [docs/insomnia/clinical-service-e2e.insomnia.json](/d:/Project%20HealthQuest/clinical-service/docs/insomnia/clinical-service-e2e.insomnia.json)

## Variáveis de ambiente

No environment da collection, use:

```json
{
  "base_url": "http://localhost:3000/v1",
  "token_owner": "",
  "token_staff": "",
  "token_patient": "",
  "plan_id": "",
  "tenant_id": "",
  "owner_staff_id": "",
  "staff_id": "",
  "invitation_id": "",
  "invitation_token": "",
  "patient_id": "",
  "template_water_id": "",
  "template_workout_id": "",
  "assignment_water_id": "",
  "assignment_workout_id": "",
  "reward_id": ""
}
```

## Geração de tokens

O projeto possui um gerador local de JWT:

- [generate-token.js](/d:/Project%20HealthQuest/clinical-service/generate-token.js)

Exemplos:

```bash
node generate-token.js owner
node generate-token.js staff
node generate-token.js patient
```

Para tenant recém-criado:

```bash
node generate-token.js owner --tenant <tenant_id>
node generate-token.js staff --tenant <tenant_id>
node generate-token.js patient --tenant <tenant_id> --sub 33333333-3333-4333-8333-333333333333 --email paciente@clinica.com
```

Observações:

- `userId` do staff deve bater com o `sub` do token do owner.
- `supabaseId` do paciente deve bater com o `sub` do token do paciente.
- Os UUIDs usados nos requests devem ser UUID v4 válidos.

UUIDs válidos usados no fluxo:

- Owner: `11111111-1111-4111-8111-111111111111`
- Staff: `22222222-2222-4222-8222-222222222222`
- Patient: `33333333-3333-4333-8333-333333333333`

## Ordem recomendada de execução

### 1. Plans

1. `Create Plan`
2. `List Plans`
3. `Get Plan By Id`

Depois do `Create Plan`, copie o `id` retornado para:

- `plan_id`

### 2. Tenants

1. `Create Tenant`
2. `List Tenants`
3. `Get Tenant By Id`
4. `Activate Tenant`

Depois do `Create Tenant`, copie o `id` retornado para:

- `tenant_id`

Depois disso, gere novamente os tokens com `--tenant <tenant_id>` e atualize:

- `token_owner`
- `token_staff`
- `token_patient`

### 3. Staff

1. `Create Owner Staff`
2. `Get My Staff Context`
3. `Create Staff Invitation`
4. `List Pending Invitations`
5. `Accept Staff Invitation`
6. `List Staff`
7. `Update Staff`
8. `Change Staff Status`
9. `List Staff Audit Logs`
10. `Revoke Staff Invitation`
11. `Cleanup Expired Invitations`

Após `Create Owner Staff`, copie:

- `owner_staff_id = response.id`

Após `Create Staff Invitation`, copie:

- `invitation_id = response.id`
- `invitation_token = response.token`

Após `Accept Staff Invitation`, copie:

- `staff_id = response.id`

### 4. Patients

1. `Create Patient`
2. `Get Patient By Id`
3. `Update Patient Profile`

Após `Create Patient`, copie:

- `patient_id = response.id`

### 5. Task Templates

1. `Create Water Template`
2. `Create Workout Template`
3. `List Task Templates`

Depois das criações, copie:

- `template_water_id = response.id` do template de água
- `template_workout_id = response.id` do template de caminhada

### 6. Task Assignments

1. `Assign Water Template`
2. `Assign Workout Template`
3. `Bulk Assign Water Template`

Depois das atribuições, copie:

- `assignment_water_id = response.id`
- `assignment_workout_id = response.id`

### 7. Patient Tasks

1. `List My Tasks`
2. `List Today Tasks`
3. `Complete Water Task`
4. `Complete Workout Task`
5. `Get Tasks Ranking`
6. `Get Detailed Tasks Ranking`

### 8. Records

1. `Create Record 1`
2. `Create Record 2`
3. `Get Records Evolution`
4. `Get Record Stats`

### 9. Rewards

1. `Create Reward`
2. `List Rewards`
3. `Claim Reward`

Depois do `Create Reward`, copie:

- `reward_id = response.id`

### 10. Dashboard

1. `Dashboard Overview`
2. `Dashboard Inactive Patients`
3. `Dashboard Recent Claims`

### 11. Game

1. `Get Player Stats`

### 12. Social

1. `Get Social Feed`

## Checks de negócio que devem ser validados

Durante a execução, confirme:

- plano é criado e pode ser consultado
- tenant só nasce com plano válido
- tenant responde com dados institucionais e endereço
- owner staff é criado com sucesso
- convite de staff gera `id` e `token`
- aceite do convite cria o profissional
- auditoria de staff registra mudanças
- paciente é criado com endereço
- profile do paciente é salvo
- templates de tarefa são criados
- atribuições de tarefa aceitam data de hoje
- paciente lista e conclui as próprias tasks
- ranking de tasks atualiza
- records geram evolução e stats
- reward é criada e pode ser resgatada
- dashboard responde para perfil autorizado
- game expõe stats do player
- social feed reflete atividade do tenant

## Erros comuns

### UUID inválido

Se aparecer erro como:

```json
{
  "message": ["userId must be a UUID"]
}
```

ou

```json
{
  "message": ["supabaseId must be a UUID"]
}
```

verifique se o valor é UUID v4 válido.

### Token com tenant incorreto

Se o token foi gerado antes da criação do tenant, regenere com:

```bash
node generate-token.js owner --tenant <tenant_id>
```

### Endpoint não encontrado

Se um endpoint recém-ajustado responder `404`, reinicie a aplicação:

```bash
npm run start:dev
```

## Observação final

Este roteiro foi validado com a arquitetura atual do projeto e com os módulos:

- `plans`
- `tenants`
- `staff`
- `patients`
- `tasks`
- `records`
- `rewards`
- `dashboard`
- `game`
- `social`
