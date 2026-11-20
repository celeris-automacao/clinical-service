# Story 011A — Apêndice de matrizes e cenários

## Matriz resumida de responsabilidade

| Campo | Tabela atual | Global ou local | Quem pode alterar | Risco atual |
|---|---|---|---|---|
| CPF | `users`, `patients`, `doctors`, `secretaries` | Global em `users`; duplicado nos demais | Paciente e fluxos excepcionais da clínica | Duplicidade e enumeração |
| Nome | `users.name` | Global | Conta/identidade | Mistura de nome civil e de exibição |
| Nascimento | `users.birth_date`, `patients.date_of_birth`, `doctors.birth_date`, `secretaries.birth_date` | Duplicado | Vários fluxos | Inconsistência |
| E-mail | `users.email` | Global | Conta | Baixo risco |
| Telefone | `users.phone` e tabelas locais | Ambíguo | Paciente/clínica | Duplicação |
| Endereço | `patients.address_*` | Local | Clínica | Adequado ao contexto local |
| Senha | `users.password_hash` | Global | Paciente | Centralizado |
| Status da conta | `users.deactivatedAt`, `isTemporaryPassword`, `temporaryPasswordExpiresAt`, `deletionRequestedAt` | Global | Auth/admin | Falta enum formal |
| Status do vínculo | `patient_clinics` sem status | N/A | — | Lacuna |
| Prontuário | Tabelas clínicas ligadas a `patientId` | Local | Clínica | Adequado |
| Notas | `patient_notes` | Local | Clínica | Adequado |
| Consentimento | `consent_records`, `data_deletion_requests` | Global | Paciente/conta | Precisa integração de identidade |

## Estados conceituais

### Conta global

- `provisional`
- `active`
- `blocked`
- `deleted`
- `merged`

### Vínculo paciente-clínica

- `pending`
- `active`
- `inactive`
- `revoked`
- `archived`

### Tratamento

- `scheduled`
- `active`
- `paused`
- `completed`
- `cancelled`

## Cenários resumidos

- **A**: clínica cria identidade provisória e vínculo local.
- **B**: paciente cria conta antes da clínica; vínculo vem depois.
- **C**: clínica encontra identidade existente e reaproveita a pessoa global.
- **D**: retorno à clínica anterior cria novo tratamento ativo, preservando histórico.
- **E**: concorrência é resolvida por unique protegido e normalização do CPF.
- **F**: CPF errado exige correção excepcional, não edição simples.
- **G**: Google/Apple entram como `AuthIdentity` vinculada à pessoa global.

## Plano de migração futura

1. Criar `global_persons` com CPF normalizado e protegido.
2. Criar `auth_identities` para login por provedor.
3. Introduzir `patient_clinic_links` com status e metadados locais.
4. Reapontar tratamentos e prontuário para o vínculo local.
5. Migrar gradualmente as leituras de `users` para a identidade global.
6. Manter compatibilidade com o esquema atual até o corte final.

## Decisões abertas

- Se `users` continuará sendo a fonte primária de autenticação ou só uma camada legada.
- Se CPF será armazenado puro, mascarado ou tokenizado.
- Qual será o rito oficial de claim/merge.
- Como expor a identidade global sem vazar contexto de outras clínicas.
