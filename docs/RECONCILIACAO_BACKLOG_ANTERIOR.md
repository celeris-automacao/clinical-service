# Reconciliação provisória de pendências anteriores

**Data da verificação:** 2026-10-15  
**Status:** provisório; o Backlog Master não foi localizado nem fornecido.
Esta tabela registra evidências locais, não altera o status oficial do backlog
nem atribui responsáveis.

| ID | Status local provisório | Evidência e encaminhamento |
|---|---|---|
| QA-VALIDATION | Parcial / staging pendente | No teste completo da API, 40/45 suítes e 185/200 casos passaram; 5 suítes falharam em áreas fora desta alteração (datas de tarefas fixas já passadas, expectativa de texto/consulta e mocks de controller). Os testes focados da integração SMTP/convites passaram (18 casos). `flutter analyze` passou, o teste do link passou (3 casos) e o build Web passou; a suíte Flutter completa já tinha falha preexistente em `widget_test.dart`. Não há URL/configuração de staging neste workspace; executar homologação funcional no staging com roteiro aprovado. |
| QA-UX | Triagem contínua não rastreada | Não foi encontrado backlog de UX, ferramenta de feedback nem fluxo de triagem. `flutter analyze` está limpo, mas não substitui validação funcional/usabilidade. Registrar relatos e reproduções no backlog oficial quando disponível. |
| OBS-EMAIL-NO-PROVIDER-001 | SMTP genérico e UX de aceite definidos; validação de entrega pendente | Foi implementado envio SMTP para convites com link por fragmento, aceite autenticado no Flutter e revogação do convite quando o envio falha. A conta convidada precisa já autenticar no tenant do convite. O teste de conexão/entrega real depende das credenciais SMTP e URL de produção configuradas como secrets; não registrar credenciais no repositório. |
| RISK-INFRA-MIGRATE-CONCURRENT-RUN | Mitigação operacional proposta; deploy não verificado | O serviço usa Prisma/PostgreSQL, mas não há pipeline nem configuração de produção no workspace. Foi adicionado `npm run db:migrate:deploy`; executar a migration em um único job coordenado por banco no release, nunca por cada réplica. A política precisa ser conectada ao pipeline real e validada no ambiente. |
| DB-MIGRATION-META-001 | Parcial | As migrations têm diretórios versionados e `migration_lock.toml` registra PostgreSQL. Foi documentado o uso de `migrate deploy`, a imutabilidade das migrations aplicadas e a verificação com `migrate status`. Não há pipeline ou monitoramento de drift neste workspace. |
| PRODUCT-DECISION-LEAP-DAY | Decisão registrada; fluxo ainda não existe | Decisão informada nesta sessão: celebrar em 28/02 nos anos não bissextos. Aplicar quando existir fluxo de aniversário, usando a data local da clínica; não há implementação de aniversários para alterar hoje. |
| RISK-BIRTHDAY-CONCURRENT-DUPLICATE | Sem fluxo afetado atualmente; risco futuro | Não foi encontrado agendador ou notificação de aniversário. Quando o fluxo for aprovado, tornar a emissão idempotente com chave única por paciente, tenant, evento e ano/fuso de referência e cobrir execução concorrente por teste. Encaminhamento conceitual registrado em [CLINIC_LIFECYCLE_TIMEZONE_SPEC.md](./CLINIC_LIFECYCLE_TIMEZONE_SPEC.md). |
| PATIENT-DOCTORS-CLINIC-LIFECYCLE | Parcial; especificação futura necessária | Há `PatientStaffLink` com estado e data de vínculo, e o cadastro de paciente pode criar um vínculo inicial. Foi criada especificação inicial de transições, histórico, autorização e consistência de tenant em [CLINIC_LIFECYCLE_TIMEZONE_SPEC.md](./CLINIC_LIFECYCLE_TIMEZONE_SPEC.md); decisões de Produto/Operações ainda bloqueiam implementação. |
| INFRA-005B / INFRA-005C | Bloqueados por escopo ausente | Os identificadores não aparecem nos repositórios e não foi encontrada descrição original. Não é seguro inferir a infraestrutura envolvida; recuperar o texto original antes de estimar ou alterar recursos. |
| CLINIC-TIMEZONE | Planejamento futuro; não implementado | O modelo `Tenant` não possui fuso horário. Definir identificador IANA, valor padrão para clínicas existentes, comportamento de horários locais/DST e política de migration antes de persistir o campo. Questões estão registradas em [CLINIC_LIFECYCLE_TIMEZONE_SPEC.md](./CLINIC_LIFECYCLE_TIMEZONE_SPEC.md). |
| MOBILE-HOMOLOGATION | Ciclo separado pendente | O frontend Flutter inclui targets móveis, mas não há evidência de matriz de dispositivos, ambiente de distribuição ou aceite de homologação. Planejar ciclo separado com builds por plataforma, dispositivos suportados, backend de teste e checklist de aceite do app do paciente. |

## Dependências para tirar itens de bloqueado

1. Backlog Master ou aceite explícito desta reconciliação provisória.
2. URL, credenciais e roteiro de staging para QA-VALIDATION.
3. Lista de problemas/feedback e responsável pelo fluxo de triagem de QA-UX.
4. Credenciais SMTP e URL HTTPS do Web injetadas pelo ambiente de deploy; executar
   `npm run email:verify` e um convite controlado no ambiente de teste.
5. Fuso por clínica e comportamento/horário local de notificações.
6. Escopo original de INFRA-005B/005C e disponibilidade do ambiente de homologação
   móvel.

Não foram executadas migrations contra banco, envios reais de e-mail, jobs
agendados, nem deploys durante esta triagem.
