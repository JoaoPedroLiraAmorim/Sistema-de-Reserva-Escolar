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
 for(const [id,papel] of [['p1','professor'],['p2','professor'],['c1','coordenacao']]) {
  sql.prepare('INSERT INTO contas (id,email,papel,identidade_externa) VALUES (?,?,?,?)').run(id,id+'@exemplo.com',papel,'firebase:test:'+id);
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
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==base)return route.abort();
   if(url.pathname==='/js/firebase-conta.js')return route.fulfill({contentType:'application/javascript',body:`export function prepararLogin(){return {cadastrar:async()=>{},reenviar:async()=>{},redefinir:async()=>{},entrar:async(email,senha,api)=>{await api('conta/entrar',{idToken:email.startsWith('coord')?'c1':'p1'});return true;},entrarGoogle:async api=>api('conta/entrar',{idToken:'p1'})};}`});
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
  assert.equal(await page.locator('[data-role]').count(),0,'não oferece acesso demo');
  await page.getByLabel('E-mail',{exact:true}).fill('professor@exemplo.com');await page.getByLabel('Senha',{exact:true}).fill('senha-de-teste');
  await page.getByRole('button',{name:'Criar conta',exact:true}).click();await page.getByText('Enviamos um link de confirmação.',{exact:false}).waitFor();
  await page.getByLabel('Senha',{exact:true}).fill('senha-de-teste');await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.waitForURL('**/pages/professor.html');await page.locator('#teacher-week-days').waitFor({state:'visible'});
  assert.equal(await page.locator('#calendarTable').isVisible(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ers_session')),null,'não cria sessão local');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ers_seeded_v6')),null,'não popula dados fictícios');
  for(const [width,height] of sizes) {
   await page.setViewportSize({width,height});await visit('pages/professor.html');await noOverflow('professor '+width);
   assert.equal(await page.locator('#v2-day-list,[data-agenda-mode="list"]').count(),0);
   const daily=width<=1100;
   assert.equal(await page.locator('#calendarHead th[data-date]:visible').count(),daily?1:6);
   if(width<=768||width===844){assert.equal(await page.locator('.calendar-scroll-area').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);assert.ok(await page.locator('#calendarBody td[data-date]:visible').first().evaluate(el=>el.getBoundingClientRect().height)>=112);}
   await page.locator('#btnOpenNewReservation').click();
   let footer=await page.locator('#new-reservation-form>.modal-footer').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=height+2);
   await page.keyboard.press('Escape');await page.evaluate(()=>openRegisterStudentsModal('active'));
   const reg=page.locator('#register-students-modal');await reg.waitFor({state:'visible'});
   if(width<=768)for(const sel of ['.modal-body','.student-registration-table-wrapper'])assert.equal(await reg.locator(sel).evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   footer=await reg.locator('.modal-footer').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=height+2);
   await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:390,height:844});await visit('pages/professor.html');
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
  for(const [width,height] of [[320,740],[820,1180],[1366,768]]) {
   await page.setViewportSize({width,height});
   for(const file of ['proatec','agendaProatec','equipamentos','salas','bloqueios','relatorio']){await visit('pages/'+file+'.html');await noOverflow(file+' '+width);}
  }
  await page.setViewportSize({width:390,height:844});await visit('pages/salas.html');
  await page.locator('#btnAddRoom').click();await page.locator('#room-name-input').fill('<img src=x onerror=alert(1)>');await page.locator('#add-room-form button[type=submit]').click();
  await page.locator('#add-room-modal').waitFor({state:'hidden'});assert.equal(await page.locator('#rooms-grid img').count(),0,'nome da sala não executa HTML');
  await page.evaluate(async()=>{const r=await ERS.confirmPickup('active');if(!r.ok)throw Error(r.message);});
  await login('p1');await visit('pages/professor.html');await page.evaluate(()=>openRegisterStudentsModal('active'));
  const reg=page.locator('#register-students-modal');await reg.locator('.student-row').first().getByRole('textbox',{name:/Etiqueta do notebook/}).fill('NT-1');
  await reg.locator('.student-row').first().getByRole('textbox',{name:/Aluno do notebook/}).fill('Aluno de teste');
  await reg.locator('button[type=submit]').click();await reg.waitFor({state:'hidden'});
  assert.equal(JSON.parse(sql.prepare("SELECT alunos FROM reservas WHERE id='active'").get().alunos)[0].aluno,'Aluno de teste');
  await login('c1');await visit('pages/relatorio.html');assert.equal(await page.evaluate(()=>ERS.getReservations().find(r=>r.id==='active').alunosNotebooks[0].aluno),'Aluno de teste');
  await login('p2');await visit('pages/professor.html');assert.deepEqual(await page.evaluate(()=>ERS.getReservations().find(r=>r.id==='active').alunosNotebooks),[]);
  await page.locator('.btn-header-logout').click();await page.waitForURL('**/index.html');
  await page.getByRole('button',{name:'Entrar com Google'}).click();await page.waitForURL('**/pages/professor.html');
  assert.deepEqual(errors,[],'sem erros JavaScript');
  console.log('UI real validada: cadastro/login e Google na interface principal; 8 viewports; 6 telas de coordenação; reserva persistida no SQL; retirada e alunos entre perfis; logout e proteção contra HTML.');
 } finally {await browser.close();sql.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
