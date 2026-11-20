# Homologacao e deploy de desenvolvimento

## Arquivos privados no EasyPanel

A API suporta `STORAGE_PROVIDER=disk` (uma instancia com volume persistente) e
`STORAGE_PROVIDER=replit` (legado, exige sidecar Replit e bucket configurados).
Nao misture providers para um mesmo conjunto de objetos sem migrar os arquivos.
O banco guarda caminhos `/objects/...`, nao o conteudo.

Para disco:

1. Monte um volume persistente em `/var/lib/modula/uploads` **na API**, nunca na
   pasta publica do Nginx. Dê permissao de leitura/escrita ao UID/GID 1000 (`node`).
2. Configure `STORAGE_PROVIDER=disk` e `LOCAL_UPLOAD_DIR=/var/lib/modula/uploads`.
3. Configure `STORAGE_SIGNING_SECRET` aleatorio com pelo menos 32 caracteres.
   Mantenha-o estavel e privado. Se omitido, usa `SESSION_SECRET` com a mesma
   exigencia. Trocar a chave invalida links de arquivos emitidos anteriormente.
4. Configure `SESSION_SECRET`, `DATABASE_URL`, `APP_URL` HTTPS e
   `ALLOWED_ORIGINS` para o ambiente. `API_UPSTREAM` do Nginx deve apontar para
   esta API, nao implicitamente para outro staging.
5. Garanta backup conjunto do banco e do volume. Recriar a API nao pode apagar
   o volume. Nao escale replicas com discos independentes; nesse caso use
   infraestrutura compartilhada ou implemente um provider de objetos apropriado.

Uploads gerais aceitam PNG/JPEG/WEBP/PDF de ate 10 MB e conferem formato, tamanho
e assinatura de URL no PUT. A URL de upload e de uso unico, com validade de
15 minutos. Links GET duram 5 minutos e so sao emitidos depois da autorizacao do
recurso. Sao credenciais temporarias: quem receber um link assinado podera usa-lo
ate expirar. Nao publique links privados nem os registre em logs.

Anexos da comunidade/conversas preservam seus endpoints autenticados e limite de
50 MB. O Nginx aceita corpos de ate 50 MB. Nenhuma pasta de uploads e exposta como
site estatico. URLs locais legadas usam o mesmo `LOCAL_UPLOAD_DIR`; preserve a
estrutura existente ao transferir arquivos.

## Build e isolamento de dados locais

`.dockerignore` exclui uploads, builds locais, relatorios e o manifesto
`__local_demo__`. `.gitignore` nao e suficiente para impedir um `COPY . .`.
Dados do banco local nao sao enviados pelo Git nem fazem parte da imagem.
Nao execute seeds de homologacao em banco remoto; os novos seeds locais recusam isso.

## Aceite antes e depois do deploy

- Aplicar migracoes e validar health; nao usar o banco de homologacao para testes
  automatizados que removam registros. Usar banco separado com sufixo `_test`.
- Rodar tipagem, testes web/API e builds.
- Logo, avatar, galeria e recibo: selecionar arquivo, enviar, salvar, recarregar e
  abrir novamente. Repetir apos recriar a API com o mesmo volume.
- Isolamento: dois proprietarios sem clinicas compartilhadas; A acessa seus
  arquivos, B recebe 403 na assinatura e download privado de A. Anonimo recebe
  401 em arquivos privados e acesso somente a imagens de pagina publicada.
- Despublicar a pagina deve impedir novas assinaturas anonimas; links emitidos
  antes permanecem utilizaveis somente ate sua expiracao.
- Verificar uso de tipos invalidos, arquivo vazio/grande, ticket expirado,
  adulterado e tentativa de reutilizar URL de upload.
- Smoke remoto: login, agenda, financeiro, pagina publica, anexos e isolamento.
  Configuracao local verde nao e prova de volume, HTTPS ou provider remoto correto.
- Configurar e validar o provedor de e-mail separadamente. WhatsApp automatico
  ainda nao esta implementado.
