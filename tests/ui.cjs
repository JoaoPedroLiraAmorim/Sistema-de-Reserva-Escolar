const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { randomBytes, createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const base = 'https://edulab.test';
const sizes = [[320,740],[390,844],[768,1024],[820,1180],[1024,768],[1366,768],[1920,1080],[844,390]];
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);

(async () => {
 const worker = (await import('../src/worker.mjs')).default;
 const sql = new DatabaseSync(':memory:');
 for(const f of fs.readdirSync(path.join(root,'migrations')).filter(f=>f.endsWith('.sql')).sort()) sql.exec(fs.readFileSync(path.join(root,'migrations',f),'utf8'));
 const DB = {prepare(query) { const s=sql.prepare(query); const bind = params => ({bind:(...p)=>bind(p),first:async()=>s.get(...params)??null,all:async()=>({results:s.all(...params)}),run:async()=>({meta:s.run(...params)})});return bind([]);},async batch(items) {sql.exec('BEGIN');try{const result=[];for(const item of items)result.push(await item.all());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const tokens = {};
 for(const [id,papel,nome] of [['p1','professor','Lúcia Braga'],['p2','professor',null],['c1','coordenacao',null]]) {
  sql.prepare('INSERT INTO contas (id,email,papel,identidade_externa,nome) VALUES (?,?,?,?,?)').run(id,id+'@exemplo.com',papel,'firebase:test:'+id,nome);
  tokens[id]=randomBytes(32).toString('base64url');
  sql.prepare('INSERT INTO sessoes VALUES (?,?,?)').run(createHash('sha256').update(tokens[id]).digest('base64url'),id,Math.floor(Date.now()/1000)+3600);
 }
 sql.exec("INSERT INTO salas VALUES ('r1','Laboratório',1); INSERT INTO equipamentos VALUES ('n1','Dell',10,2)");
 const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
 sql.prepare("INSERT INTO reservas (id,conta_id,data,inicio,fim,notebooks) VALUES ('active','p1',?,'00:00','23:59',2)").run(today);
 const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
 const assets = async request => {
  const file = path.resolve(root, '.' + new URL(request.url).pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return new Response('',{status:404});
  return new Response(fs.readFileSync(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}});
 };
 const env={DB,ASSETS:{fetch:assets},ACCOUNT_ORIGIN:base,FIREBASE_PROJECT_ID:'demo-alceu',FIREBASE_WEB_API_KEY:'test-public'};
 const browser = await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})});
 try {
  const context = await browser.newContext({timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
  const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const writes=[];
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==base)return route.abort();
   if(req.method()==='POST'&&url.pathname.startsWith('/api/'))writes.push(url.pathname);
   if(url.pathname==='/js/firebase-conta.js')return route.fulfill({contentType:'application/javascript',body:`export function prepararLogin(){return {
    cadastrar:async(email,senha,nome)=>{window.__cadastro={email,nome};return true;},
    reenviar:async()=>{},redefinir:async()=>{},
    entrar:async(email,senha,api)=>{
     if(email===window.__cadastro?.email&&!window.__emailVerificado)return false;
     await api('conta/entrar',{idToken:email.startsWith('coord')?'c1':'p1'});return true;
    },entrarGoogle:async api=>api('conta/entrar',{idToken:'p1'})};}
   export function prepararConfirmacao(config) {
    if(config.projectId!=='demo-alceu') throw Error('Projeto inesperado');
    return {conferir:async(code,mode)=>{
     if(code==='expirado')throw Object.assign(Error('expired'),{code:'auth/expired-action-code'});
     if(code==='rede'&&!window.__verificationRetried){window.__verificationRetried=true;throw Object.assign(Error('network'),{code:'auth/network-request-failed'});}
     return 'professor@exemplo.com';
    },confirmar:async()=>{window.__verificationApplied=(window.__verificationApplied||0)+1;},redefinir:async()=>{window.__passwordReset=true;}};
   }`});
   if(url.pathname==='/api/conta/entrar') {
    const id=req.postDataJSON().idToken;
    return route.fulfill({json:{ok:true},headers:{'Set-Cookie':`__Host-alceu_sessao=${tokens[id]}; Path=/; HttpOnly; Secure; SameSite=Lax`}});
   }
   const request=new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),...(req.postData()?{body:req.postData()}: {})});
   const response=await worker.fetch(request,env);
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage();
  const visit=async file=>{await page.goto(base+'/'+file);if(file.startsWith('pages/'))await page.waitForFunction(()=>!document.documentElement.classList.contains('app-loading'));};
  const login=async id=>{await context.addCookies([{name:'__Host-alceu_sessao',value:tokens[id],url:base,httpOnly:true,secure:true,sameSite:'Lax'}]);};
  const noOverflow=async label=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.body.scrollWidth<=innerWidth+1),true,label);
  const screenshot=async name=>{if(!process.env.UI_ARTIFACT_DIR)return;fs.mkdirSync(process.env.UI_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.UI_ARTIFACT_DIR,name+'.png'),fullPage:true});};
  await page.setViewportSize({width:390,height:844});await visit('index.html');
  assert.equal(await page.locator('[data-demo-role]').count(),2,'oferece dois acessos demo explícitos');
  await page.getByRole('button',{name:'Entrar com Google',exact:true}).waitFor();
  assert.ok(await page.locator('#login-google img').evaluate(img=>img.complete&&img.naturalWidth>0),'exibe o ícone do Google');
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.getByRole('heading',{name:'Crie sua conta.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Entrar com Google',exact:true}).isVisible(),false);
  await page.setViewportSize({width:320,height:740});await noOverflow('cadastro 320');
  await page.getByRole('button',{name:'Voltar para entrar',exact:true}).click();
  assert.equal(await page.getByLabel('Nome',{exact:true}).isVisible(),false);
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Informe seu nome'}).waitFor();
  await page.getByLabel('Nome',{exact:true}).fill('  Lúcia   Braga  ');
  await page.getByLabel('E-mail',{exact:true}).fill('professor@exemplo.com');await page.getByLabel('Senha',{exact:true}).fill('senha-de-teste');
  await screenshot('cadastro-celular');
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();
  await page.getByRole('heading',{name:'Bem-vindo de volta.'}).waitFor();
  await page.getByText('Enviamos um link de confirmação.',{exact:false}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__cadastro),{email:'professor@exemplo.com',nome:'Lúcia Braga'});
  assert.equal(await page.getByLabel('Senha',{exact:true}).inputValue(),'');
  await page.getByLabel('Senha',{exact:true}).fill('senha-de-teste');await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.getByText('Confirme seu e-mail antes de entrar.',{exact:true}).waitFor();
  assert.equal(writes.includes('/api/conta/entrar'),false);
  await page.evaluate(()=>{window.__emailVerificado=true;});
  await page.getByLabel('Senha',{exact:true}).fill('senha-de-teste');await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.waitForURL('**/pages/professor.html');await page.locator('.teacher-day-controls').waitFor({state:'visible'});
  await page.getByText('Olá, Lúcia Braga',{exact:true}).waitFor({state:'attached'});
  assert.equal(await page.locator('#calendarTable').isVisible(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ers_session')),null,'não cria sessão local');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ers_seeded_v6')),null,'não popula dados fictícios');
  for(const [width,height] of sizes) {
   await page.setViewportSize({width,height});await visit('pages/professor.html');await noOverflow('professor '+width);
   assert.equal(await page.locator('#v2-day-list,[data-agenda-mode="list"]').count(),0);
   assert.equal(await page.locator('#v2-room-filter,#v2-only-mine').count(),0,'professor sem filtros de sala ou de minhas reservas');
   if(width>=1920) assert.equal(await page.locator('.teacher-main-content').evaluate(el=>Math.abs(el.getBoundingClientRect().width-el.parentElement.clientWidth)<=1),true,'professor ocupa a largura disponível no desktop');
   const daily=width<=1100;
   assert.equal(await page.locator('#calendarHead th[data-date]:visible').count(),daily?1:5);
   assert.equal(await page.locator('#calendarHead th[data-date]').count(),5,'semana letiva tem cinco dias');
   if(width<=768||width===844) {
    assert.equal(await page.locator('#teacher-week-days').isVisible(),false,'celular usa apenas as setas para escolher o dia');
    const day=await page.locator('#calendarHead th[data-date]:visible').getAttribute('data-date');
    await page.locator('#v2-next-day').click();
    assert.notEqual(await page.locator('#calendarHead th[data-date]:visible').getAttribute('data-date'),day);
    await page.locator('#v2-prev-day').click();
    assert.equal(await page.locator('#calendarHead th[data-date]:visible').getAttribute('data-date'),day);
   }
   if(width<=768||width===844){assert.equal(await page.locator('.calendar-scroll-area').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);assert.ok(await page.locator('#calendarBody td[data-date]:visible').first().evaluate(el=>el.getBoundingClientRect().height)>=112);}
   await page.locator('#btnOpenNewReservation').click();
   if(width<=768||height<=560) {
    const modalBox=await page.locator('#new-reservation-modal .modal').boundingBox();
    assert.ok(modalBox.x>=15&&modalBox.x+modalBox.width<=width-15,'modal mantém margens laterais em '+width);
    assert.ok(modalBox.height<=height*.85+2,'nova reserva não ocupa a tela inteira em '+width);
   }
   const reservationBody=page.locator('#new-reservation-form>.modal-body');
   assert.equal(await reservationBody.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'reserva sem conteúdo horizontal em '+width);
   const before=await page.locator('#new-reservation-modal .modal').boundingBox();
   await reservationBody.evaluate(el=>{el.scrollLeft=100;el.scrollTop=100;});
   assert.equal(await reservationBody.evaluate(el=>el.scrollLeft),0,'reserva não desliza lateralmente em '+width);
   assert.deepEqual(await page.locator('#new-reservation-modal .modal').boundingBox(),before,'modal permanece ancorado ao rolar');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden','página ao fundo bloqueada');
   let footer=await page.locator('#new-reservation-form>.modal-footer').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=height+2);
   await page.keyboard.press('Escape');await page.evaluate(()=>openRegisterStudentsModal('active'));
   const reg=page.locator('#register-students-modal');await reg.waitFor({state:'visible'});
   if(width<=768)for(const sel of ['.modal-body','.student-registration-table-wrapper'])assert.equal(await reg.locator(sel).evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   footer=await reg.locator('.modal-footer').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=height+2);
   await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:390,height:844});await visit('pages/professor.html');
  const friday=await page.locator('#calendarHead th[data-date]').last().getAttribute('data-date');
  await page.evaluate(date=>{const button=document.querySelector(`#teacher-week-days button[data-date="${date}"]`);button.click();},friday);
  await page.locator('#v2-next-day').click();
  const monday=await page.locator('#calendarHead th[data-date]:visible').getAttribute('data-date');
  assert.equal((new Date(monday+'T12:00:00Z')-new Date(friday+'T12:00:00Z'))/86400000,3,'sexta avança direto para segunda');
  await page.locator('#v2-prev-day').click();
  assert.equal(await page.locator('#calendarHead th[data-date]:visible').getAttribute('data-date'),friday,'segunda volta direto para sexta');
  const date=await page.evaluate(()=>ERS.dateKey(ERS.getMonday(ERS.dayOffset(14))));
  await page.locator('#btnOpenNewReservation').click();await page.locator('#res-date').fill(date);
  await page.locator('#res-start').selectOption('07:00');await page.locator('#res-end').selectOption('07:50');
  await page.locator('[name="resource-type"][value="ambos"]').check();await page.locator('#res-room').selectOption('Laboratório');
  await page.locator('#res-brand').selectOption('Dell');await page.locator('#res-quantity').fill('2');
  await page.locator('#new-reservation-form button[type="submit"]').click();await page.locator('#v2-confirm-res').click();
  await page.locator('#new-reservation-modal').waitFor({state:'hidden'});
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM reservas WHERE data=?').get(date).n,1);
  await page.reload();await page.waitForFunction(()=>!document.documentElement.classList.contains('app-loading'));
  await page.locator('#mobileMyResBtn').click();assert.equal(await page.locator('.my-res-item').count(),2,'reservas persistem após recarregar');
  await page.locator('#mobileAgendaBtn').click();await screenshot('professor-real-celular');
  await login('c1');
  for(const [width,height] of [[320,740],[820,1180],[1366,768],[1920,1080],[2560,1440]]) {
   await page.setViewportSize({width,height});
   for(const file of ['proatec','agendaProatec','equipamentos','salas','bloqueios','relatorio']) {
    for(const collapsed of width>=1920?[false,true]:[null]) {
    if(collapsed!==null) await page.evaluate(value=>localStorage.setItem('escola_sidebar_collapsed',String(value)),collapsed);
    await visit('pages/'+file+'.html');await noOverflow(file+' '+width);
    if(width>=1920) {
     const bounds=await page.evaluate(()=>{const main=document.querySelector('.main-wrapper').getBoundingClientRect(),sidebar=document.querySelector('.sidebar').getBoundingClientRect();return {main:main.width,content:document.querySelector('.dashboard-content').getBoundingClientRect().width,left:main.left,sidebarRight:sidebar.right,right:main.right,viewport:innerWidth};});
     assert.ok(Math.abs(bounds.main-bounds.content)<=1,file+' preenche a largura disponível em '+width);
     assert.ok(Math.abs(bounds.left-bounds.sidebarRight)<=1,file+' fica alinhado com a lateral do menu');
     assert.ok(Math.abs(bounds.right-bounds.viewport)<=1,file+' alcança a margem direita disponível');
     if(file==='proatec'&&width===1920) await screenshot('coordenacao-desktop-'+(collapsed?'recolhido':'expandido'));
    }
    }
   }
  }
  await page.setViewportSize({width:390,height:844});await visit('pages/salas.html');
  await page.locator('#btnAddRoom').click();await page.locator('#room-name-input').fill('<img src=x onerror=alert(1)>');await page.locator('#add-room-form button[type=submit]').click();
  await page.locator('#add-room-modal').waitFor({state:'hidden'});assert.equal(await page.locator('#rooms-grid img').count(),0,'nome da sala não executa HTML');
  await login('p1');await visit('pages/professor.html');await page.evaluate(()=>openReservationDetail('active'));
  await page.getByRole('button',{name:'Reportar defeito',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement?.id==='btn-report-defect');
  assert.equal(await page.locator('#res-detail-modal').isVisible(),true,'Escape retorna aos detalhes e restaura o foco');
  await page.getByRole('button',{name:'Reportar defeito',exact:true}).click();
  await page.getByLabel('Número da etiqueta',{exact:true}).fill('NT-1');
  await page.getByLabel('Descrição do defeito',{exact:true}).fill('A tela "não" liga. <img src=x onerror=alert(1)>');
  await page.getByRole('button',{name:'Enviar relato',exact:true}).click();
  await page.locator('#report-defect-modal').waitFor({state:'hidden'});
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM defeitos_reportados').get().n,1);
  assert.equal(await page.locator('#reservation-defect-reports img').count(),0,'relato não executa HTML');
  assert.equal(sql.prepare("SELECT funcionando FROM equipamentos WHERE id='n1'").get().funcionando,10,'relato não altera estoque');
  await login('c1');await visit('pages/proatec.html');
  assert.equal(await page.locator('.sidebar-nav [data-defect-count]').textContent(),'1','Relatórios destaca relato novo');
  await visit('pages/relatorio.html');await page.locator('[data-report-tab="defeitos"]').click();
  assert.equal(await page.locator('#defects-list .defect-report').count(),1);
  await page.getByRole('button',{name:'Marcar como lido',exact:true}).focus();
  await page.evaluate(()=>window.dispatchEvent(new Event('ers:reservations-updated')));
  assert.equal(await page.getByRole('button',{name:'Marcar como lido',exact:true}).evaluate(el=>el===document.activeElement),true,'atualização sem mudanças preserva foco mesmo com aspas no relato');
  await page.getByRole('button',{name:'Marcar como lido',exact:true}).click();
  await page.waitForFunction(()=>window.ERS_DATA.defects.every(d=>d.lidoEm));
  assert.equal(await page.locator('[data-report-tab="defeitos"] [data-defect-count]').isVisible(),false,'contador baixa após leitura explícita');
  assert.equal(await page.locator('#defects-list .defect-report').count(),1,'relato lido mantém histórico');
  await screenshot('defeitos-reportados-celular');
  await page.evaluate(async()=>{const r=await ERS.confirmPickup('active');if(!r.ok)throw Error(r.message);});
  await login('p1');await visit('pages/professor.html');await page.evaluate(()=>openRegisterStudentsModal('active'));
  const reg=page.locator('#register-students-modal');await reg.locator('.student-row').first().getByRole('textbox',{name:/Etiqueta do notebook/}).fill('NT-1');
  await reg.locator('.student-row').first().getByRole('textbox',{name:/Aluno do notebook/}).fill('Aluno de teste');
  assert.equal(await reg.locator('.defect-assignment-warning:visible').count(),1,'etiqueta relatada antes do vínculo mostra alerta');
  await reg.locator('button[type=submit]').click();await reg.waitFor({state:'hidden'});
  assert.equal(JSON.parse(sql.prepare("SELECT alunos FROM reservas WHERE id='active'").get().alunos)[0].aluno,'Aluno de teste');
  await login('c1');await visit('pages/relatorio.html');assert.equal(await page.evaluate(()=>ERS.getReservations().find(r=>r.id==='active').alunosNotebooks[0].aluno),'Aluno de teste');
  await page.evaluate(()=>RelatorioModule.openRecordsModal('active'));
  assert.equal(await page.locator('#records-table-container .defect-warning').count(),1,'coordenação vê alerta no registro do aluno');
  await login('p2');await visit('pages/professor.html');assert.deepEqual(await page.evaluate(()=>ERS.getReservations().find(r=>r.id==='active').alunosNotebooks),[]);
  assert.deepEqual(await page.evaluate(()=>window.ERS_DATA.defects),[],'outro professor não acessa relatos nem nomes de alunos');
  await page.locator('.btn-header-logout').click();await page.waitForURL('**/index.html');
  await page.getByRole('button',{name:'Entrar com Google'}).click();await page.waitForURL('**/pages/professor.html');
  const savedCount = sql.prepare('SELECT COUNT(*) AS n FROM reservas').get().n;
  const roomsCount = sql.prepare('SELECT COUNT(*) AS n FROM salas').get().n;
  const writesBeforeDemo = writes.length;
  for (const role of ['professor','coordenacao']) {
   await visit('index.html');
   await page.locator(`[data-demo-role="${role}"]`).click();
   await page.waitForURL(role === 'professor' ? '**/pages/professor.html' : '**/pages/proatec.html');
   await page.locator('.demo-notice').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>ERS.getSession().role),role);
   assert.equal(await page.evaluate(()=>window.ERS_REAL),false);
   await noOverflow('demo '+role);
   if(role==='professor') {
    const result=await page.evaluate(()=>ERS.createReservation({professorId:ERS.getSession().userId,professorNome:ERS.getSession().nome,data:ERS.dateKey(ERS.getMonday(ERS.dayOffset(21))),inicio:'07:00',fim:'07:50',notebooks:1}));
    assert.equal(result.ok,true);
   } else {
    await page.locator('#v2-mobile-menu').click();
    await page.locator('#sidebar a[href="salas.html"]').click();await page.waitForURL('**/pages/salas.html');
    await page.locator('.demo-notice').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>ERS.addRoom('Sala demonstrativa').ok),true);
    await page.locator('#v2-switch').click();await page.waitForURL('**/index.html');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('alceu_demo')),null);
   }
  }
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM reservas').get().n,savedCount,'demo não grava reservas no banco real');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM salas').get().n,roomsCount,'demo não grava salas no banco real');
  assert.equal(writes.length,writesBeforeDemo,'demo não envia alterações para a API real');
  await page.getByRole('button',{name:'Entrar com Google'}).click();await page.waitForURL('**/pages/professor.html');
  await page.waitForFunction(()=>!document.documentElement.classList.contains('app-loading'));
  assert.equal(await page.evaluate(()=>window.ERS_REAL),true,'login normal retorna ao sistema real');
  for(const [width,height] of [[320,740],[390,844],[1366,900]]) {
   await page.setViewportSize({width,height});
   await visit('pages/verificar-email.html?mode=verifyEmail&oobCode=teste-valido&apiKey=outro-projeto&continueUrl=https://outro.test');
   await page.locator('#verification-confirm:enabled').waitFor();
   assert.equal(await page.evaluate(()=>window.__verificationApplied||0),0,'abrir o link não consome o código');
   assert.equal(await page.evaluate(()=>location.search),'','código removido do endereço');
   await noOverflow('confirmação '+width);
   if(width===390)await screenshot('confirmacao-email-celular');
   await page.locator('#verification-confirm').click();
   await page.getByRole('heading',{name:'E-mail confirmado!'}).waitFor();
   assert.equal(await page.evaluate(()=>window.__verificationApplied),1);
   assert.equal(await page.locator('#verification-login').getAttribute('href'),'../index.html','retorno restrito ao próprio site');
  }
  await visit('pages/verificar-email.html?mode=verifyEmail&oobCode=expirado');
  await page.getByText('Este link expirou ou já foi utilizado.',{exact:false}).waitFor();
  assert.equal(await page.locator('#verification-confirm').isVisible(),false);
  await visit('pages/verificar-email.html?mode=verifyEmail&oobCode=rede');
  await page.locator('#verification-retry').waitFor({state:'visible'});await page.locator('#verification-retry').click();
  await page.locator('#verification-confirm:enabled').waitFor();
  await visit('pages/verificar-email.html?mode=resetPassword&oobCode=teste-valido');
  await page.locator('#verification-password-form').waitFor({state:'visible'});
  await page.getByLabel('Nova senha',{exact:true}).fill('senha-teste-123');await page.getByLabel('Repita a nova senha').fill('senha-diferente');
  await page.getByRole('button',{name:'Salvar nova senha'}).click();await page.getByText('As senhas não conferem.',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>window.__passwordReset||false),false);
  await page.getByLabel('Repita a nova senha').fill('senha-teste-123');await page.getByRole('button',{name:'Salvar nova senha'}).click();
  await page.getByRole('heading',{name:'Nova senha salva!'}).waitFor();
  await visit('pages/verificar-email.html?mode=recoverEmail&oobCode=teste-valido');await page.getByRole('button',{name:'Recuperar meu e-mail'}).click();
  await page.getByRole('heading',{name:'E-mail recuperado!'}).waitFor();
  await visit('pages/verificar-email.html');await page.getByRole('heading',{name:'Não foi possível confirmar.'}).waitFor();
  const emailPreview=await context.newPage();
  await emailPreview.setViewportSize({width:600,height:900});
  await emailPreview.setContent(fs.readFileSync(path.join(root,'emails/verificar-email.html'),'utf8').replaceAll('%LINK%',base+'/pages/verificar-email.html'));
  if(process.env.UI_ARTIFACT_DIR)await emailPreview.screenshot({path:path.join(process.env.UI_ARTIFACT_DIR,'modelo-email-com-botao.png'),fullPage:true});
  await emailPreview.close();
  assert.deepEqual(errors,[],'sem erros JavaScript');
  console.log('UI validada: login real, dois perfis demo isolados, 8 viewports, telas de coordenação, persistência SQL, confirmação e recuperação de conta, retirada, alunos e logout.');
 } finally {await browser.close();sql.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
