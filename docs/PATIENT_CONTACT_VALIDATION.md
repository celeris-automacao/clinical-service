# Validação de contatos de pacientes

O cadastro exige nome, e-mail válido, telefone e CPF válido. A API normaliza
esses valores, valida nascimento como data civil `YYYY-MM-DD` e rejeita datas
futuras ou impossíveis. Contatos podem ser cadastrados sem login Supabase; o
banco gera o ID do paciente.

O CPF válido é único dentro da clínica. A migration
`20261015190000_normalize_patient_cpf_and_require_unique_per_tenant` preenche
`normalized_document` apenas para CPFs válidos e cria um índice único por
clínica. Valores legados inválidos são preservados no campo original e ficam
fora do índice; CPFs válidos duplicados interrompem a migration antes de
qualquer atualização.

A migration foi aplicada ao banco local de desenvolvimento em
`127.0.0.1:5433`. Isso não representa aplicação em staging ou produção.

O formulário Web aceita nascimento como `DD/MM/AAAA`, converte para data civil
na API e exibe os valores salvos no formato brasileiro.
