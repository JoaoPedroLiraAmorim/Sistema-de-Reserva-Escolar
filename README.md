# Alceu Reservas — Sistema de Reserva Escolar

Sistema do TCC para reservar salas e notebooks, com áreas de Professor e Coordenação.

## Ambiente de desenvolvimento publicado

O Worker `app` serve a interface em [app.reservas-alceu.workers.dev](https://app.reservas-alceu.workers.dev).
A rota `GET /api/health` responde pelo Worker e `GET /api/salas` consulta o banco D1 `edulab-dev`.
O repositório já contém o ID desse banco, a migração da tabela `salas` e um seed opcional.

O login é demonstrativo e as telas guardam reservas no localStorage. Para receber dados reais,
o sistema ainda precisa de autenticação institucional, permissões e validação de reservas no servidor.

## Executar no computador

Use Node.js 24 LTS e npm. No terminal, dentro da pasta do projeto:

```powershell
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

O comando `dev` executa a ferramenta oficial Wrangler em modo local. Ela gera `public/`
automaticamente antes de iniciar. Não exige login na Cloudflare nesta etapa.

Abra o endereço exibido no terminal, normalmente:

- Interface: http://127.0.0.1:8787/
- API: http://127.0.0.1:8787/api/health
- Salas vindas do SQL: http://127.0.0.1:8787/api/salas

A API deve responder:

```json
{"ok":true,"service":"edulab-api"}
```

Isso significa que o servidor respondeu; não verifica banco ou autenticação.
Uma rota inexistente, como `/api/reservas`, retorna 404 em JSON, pois ainda não foi implementada.
Para parar, pressione Ctrl+C no terminal.

Ao editar HTML, CSS ou JavaScript da interface, rode `npm run build` em outro terminal e
recarregue o navegador. A pasta `public/` é gerada: não edite seus arquivos diretamente.
Mudanças no código do Worker são acompanhadas pelo Wrangler.

O endereço local é um novo localStorage. Reservas salvas por arquivo, outro endereço ou outra
porta não aparecerão nele e não foram apagadas. Use sempre o mesmo endereço durante os testes.

## Entender a estrutura

| Arquivo/pasta | Responsabilidade |
| --- | --- |
| `index.html`, `pages/`, `css/`, `js/`, `imagens/` | Fontes da interface existente |
| `scripts/build.mjs` | Copia somente os tipos de arquivos públicos permitidos para `public/` |
| `public/` | Arquivos que o navegador pode receber; pasta gerada e ignorada pelo Git |
| `src/worker.mjs` | Código do servidor; trata a rota de verificação e erros da API |
| `wrangler.jsonc` | Define o servidor, a pasta pública e o encaminhamento de `/api` |
| `tests/` | Testes das regras de reserva, da API e da interface |
| `.wrangler/` | Arquivos locais gerados pela ferramenta |

As telas são entregues como arquivos estáticos. Pedidos a `/api` e `/api/*` passam pelo Worker.
O Worker também atende `/`, entregando `index.html`. Desativamos a remoção automática de
`.html` dos endereços porque a navegação atual identifica as telas por esses nomes.
O binding `ASSETS` é a ligação do Worker com os arquivos públicos.
O binding `DB` é a ligação do servidor com o banco D1, já configurado para desenvolvimento.

O build não publica `src/`, `tests/`, configurações ou arquivos de ambiente.
Nunca coloque segredos no JavaScript da interface. `.dev.vars*` e `.env*` estão ignorados pelo Git.

## Verificar

```powershell
npm test
npm run test:ui
npm run check:worker
```

- `test`: regras locais de reserva e respostas do Worker.
- `test:ui`: fluxos e responsividade da interface com Playwright; precisa de Chrome/Edge
  instalado nos caminhos usuais do Windows ou de um navegador instalado pelo Playwright.
- `check:worker`: prepara o pacote em modo de simulação, sem publicar.

O teste de interface usa arquivos locais interceptados e não substitui a verificação do
endereço servido pelo Wrangler. Confira também a interface e `/api/health` com `npm run dev`.

Para testar os mesmos fluxos pelo servidor real, mantenha `npm run dev` aberto e use outro terminal:

```powershell
$env:UI_BASE_URL = 'http://127.0.0.1:8787'
npm run test:http
npm run test:ui
Remove-Item Env:UI_BASE_URL
```

`test:http` verifica a API, o acesso aos arquivos públicos e respostas 404 para arquivos internos.

## Próximas etapas

1. Integrar Microsoft e Google: validar identidade e organização, cadastrar automaticamente
   como Professor e manter Coordenação como permissão explícita.
2. Conectar as telas e migrar reservas, estoque e bloqueios com validação no servidor e proteção contra concorrência.

## Aula prática: SQL, API e conta do TCC

### O que já funciona no computador

- `migrations/0001_criar_salas.sql` cria a estrutura da tabela. Uma migração é um passo numerado
  do histórico do banco. O Wrangler registra quais passos já foram aplicados; repetir o comando
  de migração não recria a tabela.
- `id` identifica a sala; `nome` é obrigatório e único; `ativa` só aceita 0 ou 1.
- `seeds/salas-demo.sql` insere uma sala fictícia, sem substituir uma sala existente com esse ID.
  Esse arquivo é separado da estrutura para não carregar dados demonstrativos por padrão.
- `npm run db:salas:local` executa um SELECT: consulta as linhas sem alterá-las.
- `/api/salas` faz um SELECT no D1 e converte 0/1 para false/true na resposta JSON.
- `/api/health` continua verificando somente o servidor; não testa o banco.

Para ver o SQL diretamente:

```powershell
npm run db:salas:local
```

Para comparar com a API, abra `/api/salas` no navegador com `npm run dev` aberto.
Você verá `{"salas":[{"id":"sala-demo-d1","nome":"Sala de teste D1","ativa":true}]}`
depois de executar o seed. Antes dele, um banco com a migração aplicada retorna `{"salas":[]}`.
Uma falha de banco retorna 503, não uma lista vazia enganosa.

O banco local fica em `.wrangler/`, não no localStorage, e persiste ao reiniciar o servidor.
As migrações e seeds não importam nem modificam dados do navegador.

### Criar um banco em outra conta Cloudflare

O ambiente de desenvolvimento do TCC já tem um `edulab-dev`. Siga estes passos quando
precisar configurar o projeto em outra conta.

A conta Cloudflare é independente da conta usada no ChatGPT. Execute pessoalmente, no terminal
do projeto, um comando de cada vez:

```powershell
npx wrangler login
```

O navegador abrirá a autorização do Wrangler. Confira a conta de destino antes de autorizar.
Se o navegador mostrar outra conta, troque de conta antes de concluir.

```powershell
npx wrangler whoami
```

Confira o usuário e a conta Cloudflare disponíveis. Se houver várias contas, selecione
a conta de destino explicitamente na configuração antes de criar recursos. Não prossiga com a conta errada.

```powershell
npx wrangler d1 create edulab-dev
```

Este é o primeiro comando que cria um recurso na nuvem: um banco de desenvolvimento vazio.
Não cria um Worker publicado nem migra os dados locais.
Ele exibirá um `database_id`. Esse identificador não é uma senha. Precisamos adicionar o ID real
à entrada `d1_databases` existente de `wrangler.jsonc`, sem duplicar o binding `DB`.
Se o Wrangler oferecer atualizar a configuração automaticamente, confira o diff resultante.
Não invente um ID: ele só existe depois da criação.

Após confirmar o ID e a conta, estes comandos aplicam a mesma estrutura na nuvem:

```powershell
npx wrangler d1 migrations apply edulab-dev --remote
npx wrangler d1 execute edulab-dev --remote --command "SELECT id, nome, ativa FROM salas;"
```

O resultado do SELECT será vazio, pois a migração cria a tabela sem inserir exemplos.
Para inserir o mesmo exemplo, somente nesse banco de desenvolvimento:

```powershell
npx wrangler d1 execute edulab-dev --remote --file seeds/salas-demo.sql
```

`--local` altera o banco do computador; `--remote` altera o banco da conta Cloudflare.
Eles não sincronizam os dados. A opção `remote: false` do binding mantém `npm run dev` no banco
local, mesmo depois de preencher `database_id`. Ver a tabela no painel não faz a interface local
usar esse banco automaticamente.

A rota `/api/salas` é pública e somente leitura. Use apenas exemplos de desenvolvimento.

Domínios institucionais informados: Microsoft `professor.educacao.sp.gov.br` e Google
`prof.educacao.sp.gov.br`. A integração depende dos aplicativos e permissões dos provedores;
os domínios digitados sozinhos não comprovam a identidade.

## Publicação pelo painel (ambiente de desenvolvimento)

No Workers & Pages, a aplicação e o campo `name` do Wrangler devem usar
`app`. O endereço publicado é `https://app.reservas-alceu.workers.dev`. Para configurar
a integração de build pelo painel, selecione este repositório e a branch `main`.
O código e os arquivos estáticos são publicados juntos.

| Campo do painel | Valor |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | Raiz do repositório (`/`) |

O `package-lock.json` é versionado para instalar as versões verificadas das dependências.
O banco de desenvolvimento configurado usa o binding `DB`; confirme no painel que o ID
corresponde ao seu `edulab-dev` antes da publicação. `remote: false` controla apenas o
desenvolvimento local: o Worker publicado acessa o banco da Cloudflare pelo ID configurado.

Esta publicação é uma demonstração: as telas ainda usam localStorage e login demonstrativo.
Somente `/api/salas` consulta o D1. Não coloque dados reais de alunos nessa versão.
Nenhuma migração ou seed é executado automaticamente durante o build ou deploy.
Se a tabela foi criada manualmente no Console, precisamos reconciliar o histórico de
migrações antes de aplicar a primeira migração pelo Wrangler; não apague a tabela para isso.

Depois do deploy, confira no endereço fornecido pelo painel:

1. `/`: abre o acesso do sistema.
2. `/api/health`: retorna `{"ok":true,"service":"edulab-api"}`.
3. `/api/salas`: retorna a lista de salas do banco de desenvolvimento.

Se o último retornar 503, confira o binding `DB`, o ID do banco e a existência da tabela `salas`.

## Referências oficiais

Consultadas em 26/10/2026:

- [Workers com arquivos estáticos](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Configuração do Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Desenvolvimento local](https://developers.cloudflare.com/workers/local-development/)
- [D1 local](https://developers.cloudflare.com/d1/best-practices/local-development/)
- [Migrações do D1](https://developers.cloudflare.com/d1/reference/migrations/)
