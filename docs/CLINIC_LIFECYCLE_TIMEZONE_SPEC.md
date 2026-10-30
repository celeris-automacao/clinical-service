# Especificação inicial: vínculos clínicos e fuso horário

**Status:** proposta para validação de Produto/Operações; não implementada.

## Evidência atual

- `PatientStaffLink` liga paciente, profissional e tenant, com `active`/`inactive`,
  `assignedAt` e chave primária `(patientId, staffId)`.
- O cadastro de paciente pode criar o vínculo inicial.
- Não foi encontrado fluxo dedicado de reatribuição, encerramento ou consulta de
  histórico dos vínculos.
- `Tenant` não possui fuso horário.

## Vínculo paciente-profissional-clínica

### Comportamentos propostos

1. Criar o vínculo inicial como ativo quando paciente e profissional forem
   registrados para a mesma clínica.
2. Reatribuir encerrando o vínculo ativo anterior e criando outro, mantendo os
   eventos anteriores consultáveis; evitar sobrescrever o histórico.
3. Encerrar um vínculo sem substituição sem apagar registros clínicos já
   associados.
4. Registrar autor, instante e motivo de cada atribuição, reatribuição e
   encerramento.
5. Validar em cada operação que paciente, profissional e clínica pertencem ao
   mesmo tenant; a integridade não deve depender apenas do identificador enviado
   pelo cliente.

### Decisões necessárias antes de implementar

- Se um paciente pode ter vários profissionais ativos simultaneamente e quais
  especialidades/roles podem ser responsáveis.
- Quem pode atribuir, reatribuir e encerrar vínculos, e se o paciente precisa
  consentir ou receber aviso.
- Se vínculos encerrados podem ser reativados ou se toda reativação cria novo
  evento de histórico.
- Quais telas e consultas devem mostrar somente o vínculo atual versus o
  histórico.

## Fuso horário da clínica

### Comportamentos propostos

- Persistir um identificador IANA (por exemplo, `America/Sao_Paulo`), não um
  offset fixo, porque o offset pode variar por regra local.
- Persistir instantes operacionais em UTC e converter para o fuso da clínica ao
  calcular datas locais, janelas de atendimento e notificações agendadas.
- Tratar aniversários como data civil (`birthDate`), sem deslocar a data por
  conversão UTC.
- Definir explicitamente o fuso para clínicas existentes durante a migration;
  não inferir silenciosamente um valor de produção.
- Testar mudanças de dia, limites de ano e regras de horário de verão quando
  aplicáveis ao fuso escolhido.

### Decisões necessárias antes de implementar

- Fuso padrão para novas clínicas e política de preenchimento para clínicas
  existentes.
- Quem pode alterar o fuso e se a alteração afeta apenas eventos futuros ou
  também interpretações históricas.
- Horário local de disparo das notificações recorrentes.

## Idempotência e aniversário em 29/02

Não há atualmente fluxo de aniversário identificado. Quando aprovado, cada
notificação deverá ter identidade idempotente por paciente, tenant, tipo de
evento, ano e data local de referência, protegida também por restrição única no
banco para evitar duplicação em execuções concorrentes.

**Decisão de Produto registrada:** aniversários em 29/02 devem ser considerados
em 28/02 nos anos não bissextos. O fluxo de aniversário ainda não existe; aplicar
esta regra quando a funcionalidade for implementada, sempre usando a data local
da clínica.

## Critérios mínimos para futura homologação

- Testar cadastro, reatribuição, encerramento e acesso após cada transição.
- Testar isolamento entre tenants e concorrência em reatribuições simultâneas.
- Testar execução repetida/concorrente de notificações no mesmo ano local.
- Validar data civil e horário local nos limites de dia/ano e nos fusos aprovados.
