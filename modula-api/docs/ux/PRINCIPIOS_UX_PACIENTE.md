# Princípios de UX do Paciente

## 1. Objetivo do documento

Este documento orienta as decisões de UX do aplicativo do paciente sobre:

- arquitetura da informação;
- navegação;
- criação de telas;
- componentes reutilizáveis;
- priorização de funcionalidades;
- revisão de histórias futuras;
- consistência entre tratamentos e clínicas.

Ele serve como referência para manter a experiência simples, contextualizada e previsível.

## 2. Visão da experiência

- O paciente possui uma identidade única.
- Um paciente pode ter vários tratamentos ativos.
- Um paciente pode ter tratamentos em várias clínicas.
- Cada clínica permanece isolada no seu próprio contexto.
- O paciente possui uma visão consolidada da sua jornada.
- O tratamento é a unidade central da experiência.

## 3. Princípio central

Toda informação clínica deve responder claramente:

> De qual tratamento isso faz parte?

Se a resposta não for clara, a informação provavelmente está na tela errada.

## 4. Princípios obrigatórios

### Contato com a clínica pela página pública

- Os botões “Falar com a clínica” abrem um formulário na própria página, sem depender de um aplicativo de e-mail.
- Nome, telefone válido com DDD, recado e autorização de contato são obrigatórios. Não solicitar dados clínicos neste formulário.
- O envio cria um lead em “Solicitações e Leads” na clínica da página, mesmo quando o navegador está autenticado em outra clínica. O proprietário ativo fica como responsável; owner e secretaria podem acompanhar e trabalhar o lead no funil.
- O recado fica visível nas notas do lead. A equipe pode responder ao contato e atualizar o estágio; esse fluxo não reserva nem agenda uma consulta.
- Reenvios idênticos não duplicam o lead; falhas e indisponibilidade devem ser visíveis, sem mensagem de sucesso falsa. O endpoint limita solicitações por IP.
- As clínicas de demonstração também aceitam esse fluxo local, sem enviar e-mail, WhatsApp ou gerar cobranças reais.

### Questionários com tipos de resposta

- Cada pergunta pode ser configurada como Sim/Não, texto livre ou múltipla escolha, tanto na criação quanto na edição.
- Na múltipla escolha, cadastrar uma alternativa por linha, com pelo menos duas alternativas diferentes e sem o separador `|`.
- O paciente pode marcar mais de uma alternativa; os demais tipos usam botões Sim/Não ou campo de texto.
- A edição preserva as perguntas e alternativas existentes até que sejam explicitamente alteradas.

### Datas no padrão brasileiro

- Exibir datas completas em `dd/MM/aaaa`, por exemplo `30/10/2026`, na web e no aplicativo.
- Na web, usar o componente compartilhado `DateInput`, com calendário em português, em vez de depender do formato do navegador.
- Manter os valores enviados à API e persistidos no banco em `YYYY-MM-DD`.
- Tratar datas sem horário como datas de calendário local, sem conversão UTC que possa exibir o dia anterior.
- Preservar rótulos compactos de gráficos e seletores de mês/ano quando não representarem uma data completa.

### PUX-01 — O tratamento é a unidade central

- O paciente não navega prioritariamente por clínica.
- Clínica é contexto.
- Tratamento é o elemento principal.
- Tarefas, metas, consultas, materiais e evolução pertencem ao tratamento.

### PUX-02 — A Home mostra contexto e prioridades

A Home deve responder:

- quantos tratamentos estão ativos;
- o que precisa de atenção hoje;
- qual é a próxima consulta;
- se existem mensagens ou pendências.

A Home não deve exibir:

- métricas clínicas detalhadas;
- gráficos;
- edição de metas;
- água;
- calorias;
- peso;
- check-ins detalhados;
- dados sem contexto de tratamento.

### PUX-03 — O Workspace concentra a execução

O Workspace do Tratamento deve concentrar:

- Hoje;
- objetivos;
- tarefas;
- check-ins;
- consultas;
- questionários;
- materiais;
- mensagens;
- equipe;
- evolução;
- histórico.

### PUX-04 — Próxima ação sempre visível

O paciente deve compreender rapidamente:

- o que fazer agora;
- o que está pendente;
- o que está atrasado;
- o que foi concluído.

### PUX-05 — Progressão do global para o específico

Fluxo base:

Login
↓
Home
↓
Tratamento
↓
Ação ou registro

Evitar abrir detalhes clínicos diretamente na Home.

### PUX-06 — Multiclínica sem confusão

- Tratamentos devem ser agrupados visualmente.
- Cada card deve indicar a clínica.
- Dados de clínicas diferentes nunca devem ser misturados.
- Troca de contexto deve ser explícita.
- O paciente não deve precisar trocar de conta.

### PUX-07 — Informação clínica sempre contextualizada

Exemplo inadequado:

- Água: 1,2 L

Exemplo adequado:

- Programa de Emagrecimento
- Água: 1,2 L de 2 L

### PUX-08 — Foco em ação, não em dashboard

Preferir:

- “Registrar peso”;
- “Responder questionário”;
- “Consulta amanhã”;
- “2 tarefas pendentes”.

Evitar excesso de:

- gráficos;
- KPIs;
- percentuais sem significado;
- informações decorativas.

### PUX-09 — Complexidade progressiva

- Mostrar primeiro o essencial.
- Revelar detalhes sob demanda.
- Evitar telas longas com todos os módulos.
- Usar navegação por seções ou abas quando fizer sentido.

### PUX-10 — Estado vazio não é erro

Exemplos:

- sem tratamento;
- sem tarefa;
- sem mensagem;
- sem consulta;
- sem histórico.

Cada estado vazio deve explicar:

- o que significa;
- o que acontecerá depois;
- se existe alguma ação possível.

### PUX-11 — Erros devem ser acionáveis

Mensagens devem informar:

- o que aconteceu;
- o que o paciente pode fazer;
- como tentar novamente.

Nunca exibir:

- stack;
- códigos internos;
- mensagens técnicas;
- culpa indevida atribuída à clínica.

### PUX-12 — Acessibilidade e clareza

Considerar:

- fontes legíveis;
- contraste;
- áreas de toque;
- linguagem simples;
- navegação previsível;
- feedback visual;
- pacientes com diferentes níveis de familiaridade digital.

## 5. Arquitetura da informação

### Home

- Prioridades de hoje
- Tratamentos ativos
- Próxima consulta
- Mensagens recentes
- Perfil

### Workspace do Tratamento

- Hoje
- Objetivos
- Tarefas
- Check-ins
- Consultas
- Questionários
- Materiais
- Mensagens
- Equipe
- Evolução
- Histórico

## 6. Hierarquia visual da Home

Ordem de prioridade sugerida:

1. saudação;
2. ação urgente;
3. tratamentos ativos;
4. próxima consulta;
5. mensagens;
6. conteúdo secundário.

## 7. Regras para cards de tratamento

Cada card deve responder:

- qual é o tratamento;
- qual clínica acompanha;
- qual o status;
- o que precisa ser feito hoje;
- se existe alerta;
- qual ação abre o workspace.

Exemplo conceitual:

Emagrecimento Premium
Clínica Vida

Em dia
3 tarefas hoje
Consulta amanhã

`[Abrir tratamento]`

## 8. Conceito “Missão do dia”

A “Missão do dia” é uma proposta para agrupar ações do tratamento.

Ela deve:

- agregar as ações do tratamento;
- mostrar progresso;
- evitar múltiplos cards soltos;
- adaptar-se ao tipo de tratamento;
- não exibir tarefas inexistentes.

Exemplo:

Missão de hoje

- ✓ Registrar água
- ☐ Fazer exercício
- ☐ Responder questionário

1 de 3 concluídas

## 9. Estados do tratamento

Linguagem visual e textual para:

- ativo;
- agendado;
- pausado;
- concluído;
- cancelado;
- em dia;
- atenção;
- atrasado.

Não depender apenas de cor.

## 10. Padrões de navegação

- Home abre lista consolidada.
- Card abre Workspace.
- Workspace abre seção.
- Seção abre registro.
- Voltar preserva contexto.
- Nenhum dado clínico inteiro deve ser passado pela URL.
- Contexto deve ser carregado por identificador seguro.

## 11. Linguagem e tom

A comunicação deve ser:

- simples;
- acolhedora;
- objetiva;
- não julgadora;
- não punitiva;
- orientada à ação.

Evitar:

- linguagem técnica;
- excesso de termos médicos;
- mensagens que gerem culpa;
- tom infantilizado.

## 12. Critérios de revisão de uma tela

Toda nova tela deve responder:

- Qual tratamento é o contexto?
- Qual é a ação principal?
- O que o paciente precisa saber agora?
- Existe informação que deveria estar em outro nível?
- Há conteúdo de outra clínica misturado?
- O estado vazio está claro?
- O erro é acionável?
- A tela funciona para um e vários tratamentos?
- A tela é compreensível em poucos segundos?
- A hierarquia visual está clara?

## 13. Anti-patterns

São proibidos:

- métricas clínicas soltas na Home;
- seleção obrigatória de clínica antes de ver tratamentos;
- mistura de dados entre tratamentos;
- uma Home diferente por clínica;
- dashboard excessivamente analítico;
- ações sem indicar o tratamento;
- dependência de cor para status;
- mensagens genéricas sem retry;
- informações clínicas em cache após logout;
- duplicação de dados entre Home e Workspace.

## 14. Relação com as próximas stories

Sequência esperada:

- UX-002 — Workspace do Tratamento;
- UX-003 — Missão do Dia;
- UX-004 — Timeline;
- UX-005 — Evolução;
- UX-006 — Consultas;
- UX-007 — Questionários;
- UX-008 — Materiais;
- UX-009 — Mensagens;
- UX-010 — Equipe.

Cada story deve obedecer aos princípios deste documento.

## 15. Checklist de aceite UX

- [ ] A informação pertence a um tratamento claro
- [ ] A ação principal está visível
- [ ] Não há mistura entre clínicas
- [ ] A Home não recebeu detalhe clínico indevido
- [ ] O estado vazio está tratado
- [ ] O erro é acionável
- [ ] A navegação preserva contexto
- [ ] A tela funciona com múltiplos tratamentos
- [ ] A linguagem é simples
- [ ] A acessibilidade básica foi considerada
