const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const dir = join(__dirname, '../migrations');
const cleanup = readFileSync(join(dir, '0009_remover_tabelas_legadas.sql'), 'utf8');
function fixture(t) {
 const db = new DatabaseSync(':memory:'); t.after(() => db.close());
 db.exec('PRAGMA foreign_keys=ON');
 for (const name of readdirSync(dir).filter(n => n.endsWith('.sql') && n < '0009').sort()) db.exec(readFileSync(join(dir, name), 'utf8'));
 return db;
}
function apply(db) {
 db.exec('BEGIN');
 try { db.exec(cleanup); db.exec('COMMIT'); }
 catch (error) { db.exec('ROLLBACK'); throw error; }
}
test('limpeza deixa oito tabelas e preserva contas e reservas migradas', t => {
 const db = fixture(t);
 db.exec(`INSERT INTO contas (id,email,papel,identidade_externa) VALUES ('p','p@teste.local','professor','firebase:teste:p');
 INSERT INTO salas VALUES ('s','Sala teste',1);
 INSERT INTO reservas_salas VALUES ('r','s','p','2026-01-01','09:00','10:00');
 INSERT INTO reservas (id,conta_id,sala_id,data,inicio,fim) VALUES ('r','p','s','2026-01-01','09:00','10:00');`);
 apply(db);
 assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name), ['bloqueios','contas','defeitos_reportados','equipamentos','reservas','reservas_alteracoes','salas','sessoes']);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reservas').get().n, 1);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM contas').get().n, 1);
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});
test('limpeza bloqueia reservas antigas ausentes e preserva as tabelas', t => {
 const db = fixture(t);
 db.exec(`INSERT INTO contas (id,email,papel,identidade_externa) VALUES ('p','p@teste.local','professor','firebase:teste:p');
 INSERT INTO salas VALUES ('s','Sala teste',1);
 INSERT INTO reservas_salas VALUES ('r','s','p','2026-01-01','09:00','10:00');`);
 assert.throws(()=>apply(db), /legado_precisa_de_revisao/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reservas_salas').get().n, 1);
 db.exec(`INSERT INTO reservas (id,conta_id,sala_id,data,inicio,fim) VALUES ('r','p','s','2026-01-01','10:00','11:00');`);
 assert.throws(()=>apply(db), /legado_precisa_de_revisao/);
});
test('limpeza bloqueia convites e desafios nao vazios', t => {
 const db = fixture(t);
 db.exec("INSERT INTO convites VALUES ('h','p@teste.local','professor',0)");
 assert.throws(()=>apply(db), /legado_precisa_de_revisao/);
 db.exec("DELETE FROM convites; INSERT INTO desafios (id,tipo,desafio,expira) VALUES ('d','login','teste',0)");
 assert.throws(()=>apply(db), /legado_precisa_de_revisao/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM desafios').get().n, 1);
});

test('nome obrigatorio preserva contas, sessoes e referencias', t => {
 const db = fixture(t);
 apply(db);
 db.exec("INSERT INTO contas (id,email,papel,identidade_externa,nome) VALUES ('p','p@teste.local','professor','firebase:teste:p','Pessoa Teste'); INSERT INTO sessoes VALUES ('hash','p',123);");
 const migrate = () => {
  db.exec('BEGIN');
  try { db.exec(readFileSync(join(dir, '0010_nome_obrigatorio.sql'), 'utf8')); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
 };
 migrate();
 assert.equal(db.prepare('PRAGMA table_info(contas)').all().find(c=>c.name==='nome').notnull, 1);
 assert.equal(db.prepare("SELECT nome FROM contas WHERE id='p'").get().nome, 'Pessoa Teste');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessoes').get().n, 1);
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
 for (const nome of [null, '', '   ']) assert.throws(()=>db.prepare("UPDATE contas SET nome=? WHERE id='p'").run(nome), /NOME_OBRIGATORIO|NOT NULL/);
 assert.throws(()=>db.exec("INSERT INTO contas (id,email,papel,identidade_externa) VALUES ('q','q@teste.local','professor','firebase:teste:q')"), /NOME_OBRIGATORIO/);
});
test('migracao do nome aborta sem alterar contas sem nome', t => {
 const db = fixture(t); apply(db);
 db.exec("INSERT INTO contas (id,email,papel,identidade_externa) VALUES ('p','p@teste.local','professor','firebase:teste:p')");
 db.exec('BEGIN');
 assert.throws(()=>db.exec(readFileSync(join(dir, '0010_nome_obrigatorio.sql'),'utf8')), /NOT NULL/);
 db.exec('ROLLBACK');
 assert.equal(db.prepare("SELECT nome FROM contas WHERE id='p'").get().nome, null);
 assert.equal(db.prepare('PRAGMA table_info(contas)').all().some(c=>c.name==='nome_obrigatorio'), false);
});
