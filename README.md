# Alceu Reservas — Sistema de Reserva Escolar

Sistema de reservas de salas e notebooks, com uma interface para Professor e Coordenação.

## Site publicado

https://app.reservas-alceu.workers.dev

O Firebase Authentication autentica contas Google e e-mail/senha. O Worker Cloudflare serve a interface e a API; o banco D1 edulab-dev guarda as contas, sessões, salas, estoque, reservas, bloqueios, retiradas e vínculos de alunos. O nome do banco é legado; a publicação usa sua instância remota.

Após entrar, professores abrem pages/professor.html e a Coordenação abre pages/proatec.html. A antiga pages/conta.html redireciona para a interface principal.

Os botões **Professor demo** e **Coordenação demo** permitem experimentar a mesma interface com dados fictícios. Não exigem senha e não gravam no banco real. A sessão demo fica nesta aba; os exemplos ficam no navegador com o prefixo alceu_demo:. Use Sair para retornar ao login normal. Os perfis demo não concedem acesso às APIs autenticadas.

## Dados e permissões

- A sessão usa cookie HttpOnly e dura oito horas. O perfil é conferido pelo servidor em cada operação.
- Novas contas entram como Professor. O cadastro pede nome, e-mail e senha, envia a verificação e retorna ao login. Confirmar o e-mail é necessário para entrar com senha. O nome usado na sessão vem da identidade Firebase verificada.
- Professores reservam recursos para si e cancelam suas reservas. A Coordenação pode reservar para professores ativos, cancelar reservas e gerenciar salas, estoque e bloqueios.
- Apenas a Coordenação confirma retiradas, durante o horário da reserva. O registro de alunos exige a retirada confirmada, fica limitado à quantidade de notebooks e é visível somente ao professor responsável e à Coordenação.
- Salas, marcas e quantidades devem ser cadastradas pela Coordenação. A integração não importa os exemplos antigos do navegador nem cria estoque fictício.
- Os dados do sistema ficam no SQL. O navegador guarda apenas preferências como menu e e-mail lembrado. A interface mantém um cache em memória e consulta atualizações a cada 15 segundos.
- Horários e validações do servidor usam America/Sao_Paulo. Conflitos de sala, bloqueios e estoque são verificados na gravação, inclusive em pedidos concorrentes.
- A criação é permitida até 15 minutos após o início, inclusive, enquanto a aula não terminou. A edição de reserva própria exige ausência de retirada e respeita até 10 minutos após os inícios original, atual e de destino. Vale o primeiro prazo a vencer; alterar o horário não renova a tolerância. Alterações ficam registradas no banco.
- Bloqueios aceitam intervalo inclusivo de datas e todos os horários. O motivo é opcional. Reservas afetadas continuam no histórico, sinalizadas como bloqueadas, sem cancelamento automático.
- Durante sua aula com notebooks, o professor pode abrir os detalhes da reserva e reportar um defeito por etiqueta e descrição, inclusive antes da confirmação da retirada. O relato guarda autor, horário do servidor e contexto da aula, é privado entre professores e fica visível à Coordenação em **Relatórios → Defeitos reportados**. O contador indica relatos não lidos; **Marcar como lido** baixa o contador e preserva o relato.
- Os registros de aluno mostram um alerta quando a etiqueta possui relato na mesma reserva, independentemente de o aluno ter sido vinculado antes ou depois. O relato não atribui responsabilidade ao aluno nem muda automaticamente as quantidades do estoque; a Coordenação confirma os ajustes no controle de equipamentos existente.
- Espaço Maker foi retirado dos catálogos e da demonstração. A migração 0008 desativa eventual cadastro antigo, impede recadastro/reativação e preserva reservas históricas vinculadas.
- A migração 0004 preserva as reservas existentes em reservas_salas. A tabela antiga permanece como origem histórica; as novas gravações usam reservas. Nenhuma conta ou reserva existente é apagada.
- O histórico permanece no banco. A agenda e os relatórios de reservas consultam o dia atual e datas futuras; uma consulta histórica completa de reservas ainda não está disponível na interface. A subaba de defeitos mantém também os relatos de aulas passadas.

## E-mails e confirmação de conta

O SDK e o idioma padrão das notificações Firebase usam pt-BR. O nome visual do projeto é Alceu Reservas; o ID continua projetotcc-3ds.

A página pages/verificar-email.html tem a identidade visual do sistema e trata confirmação de e-mail, recuperação de endereço e redefinição de senha. Usa a configuração confiável da API, verifica os códigos no Firebase e exige uma ação explícita para confirmar. O código de uso único sai do endereço assim que a página carrega.

O arquivo emails/verificar-email.html contém o modelo HTML com botão “Verificar meu e-mail”, usando o marcador %LINK%. Ele não é publicado como um arquivo do site nem é enviado pelo fluxo atual.

Em 18/11/2026, a API Firebase recusou alterações do corpo, assunto, remetente e callbackUri com EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED, mesmo na conta administradora. Portanto, o envio padrão mantém o template e a página de destino do Firebase. Para ativar o modelo completo e o destino https://app.reservas-alceu.workers.dev/pages/verificar-email.html, é necessário liberar a configuração com o suporte Firebase ou integrar um serviço próprio de envio. Não há credenciais SMTP no repositório.

## Desenvolvimento local

Use Node.js 24 e as dependências do package-lock.json:

~~~powershell
npm install
npm run db:migrate:local
npm run dev
~~~

Abra http://127.0.0.1:8787. O banco local é independente do publicado. O seed opcional de salas é somente para desenvolvimento.

Para entrar de verdade no endereço local, configure FIREBASE_PROJECT_ID e FIREBASE_WEB_API_KEY em .dev.vars e autorize o host local no Firebase Authentication. Nunca versione esse arquivo. A publicação já usa o projeto projetotcc-3ds.

A migração não cria uma conta de Coordenação. Um administrador deve promover a identidade correta no D1 Console, pelo identificador Firebase verificado:

~~~sql
UPDATE contas SET papel = 'coordenacao'
WHERE identidade_externa = 'firebase:projetotcc-3ds:UID_DA_PESSOA';
~~~

## Arquitetura

| Arquivo/pasta | Responsabilidade |
| --- | --- |
| index.html, pages/, css/, js/ | Interface compartilhada |
| js/real-mode.js, js/real-store.js | Inicialização da sessão, cache em memória e gravações pela API |
| js/store.js | Utilitários e cálculos da interface e dados locais exclusivos da demonstração |
| firebase/client.mjs | Login e verificação de e-mail pelo Firebase |
| src/contas.mjs | Validação de identidade Firebase e sessões |
| src/sistema.mjs | Dados compartilhados, permissões e operações de recursos/reservas |
| migrations/ | Evoluções do SQL, sem aplicação automática no build |
| scripts/build.mjs | Geração de public/; não editar arquivos gerados |

A API de sessão está em /api/conta/sessao. /api/agenda/estado retorna os dados permitidos à conta e /api/agenda/acao recebe as operações explícitas da interface. /api/health confirma a resposta do Worker; /api/salas permite consultar o catálogo de salas.

## Verificações

~~~powershell
npm test
npm run test:ui
npm run check:worker
~~~

Os testes de interface usam o código real do Worker e SQLite em memória, com o login Firebase substituído por identidades fictícias de teste. Cobrem cadastro/login na interface principal, oito viewports, telas da Coordenação, persistência, retiradas, relatos de defeito, contador/leitura, alertas por etiqueta, privacidade dos alunos e logout. Os testes de regras cobrem os instantes exatos das tolerâncias, concorrência e estoque. Nenhum dado de teste é enviado à publicação.

As migrações 0005–0008 precisam ser aplicadas junto com a versão que usa as novas regras, os nomes e os relatos. Elas não são aplicadas automaticamente pelo build. A preparação dessas alterações não publica o Worker nem altera o banco remoto.

Com npm run dev aberto:

~~~powershell
npm run test:http
~~~

## Publicação

O build gera os assets e o pacote Firebase. Para atualizar o Worker existente, preserve as variáveis configuradas no painel:

~~~powershell
npx wrangler d1 migrations apply edulab-dev --remote
npx wrangler deploy --keep-vars
~~~

Aplique somente migrações revisadas e confira a conta, o Worker app e o ID do banco em wrangler.jsonc antes de publicar. Nenhuma migração é executada automaticamente pelo build.

O domínio .web.app requer publicação no Firebase Hosting. Firebase Authentication, usado aqui, é independente da hospedagem; migrar o host exige adaptar a ligação com a API e os cookies da sessão.
