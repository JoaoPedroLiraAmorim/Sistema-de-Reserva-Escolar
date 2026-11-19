const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const modulePromise = import('../src/defeitos.mjs');

function fixture(t) {
    const sql = new DatabaseSync(':memory:'); t.after(() => sql.close());
    for (const f of readdirSync(join(__dirname, '../migrations')).filter(f => f.endsWith('.sql')).sort()) sql.exec(readFileSync(join(__dirname, '../migrations', f), 'utf8'));
    const db = { prepare(query) {
        const statement = sql.prepare(query);
        const bound = values => ({ bind: (...args) => bound(args), first: async () => statement.get(...values) || null,
            all: async () => ({ results: statement.all(...values) }), run: async () => ({ meta: statement.run(...values) }) });
        return bound([]);
    } };
    sql.exec(`INSERT INTO contas (id,email,papel,nome,identidade_externa) VALUES ('p1','p1@escola.test','professor','Professora Um','firebase:test:p1'),('p2','p2@escola.test','professor','Professor Dois','firebase:test:p2'),('c1','c1@escola.test','coordenacao','Coordenação','firebase:test:c1');
        INSERT INTO equipamentos VALUES ('n1','Dell',10,0);
        INSERT INTO reservas (id,conta_id,data,inicio,fim,notebooks) VALUES ('r1','p1','2026-11-19','09:30','10:20',2);`);
    return { sql, db, p1: { id: 'p1', papel: 'professor' }, p2: { id: 'p2', papel: 'professor' }, c1: { id: 'c1', papel: 'coordenacao' } };
}
const now = () => new Date('2026-11-19T12:35:00Z');
const report = overrides => ({ reservaId: 'r1', etiqueta: 'NT-01', descricao: 'A tela não liga.', ...overrides });

test('relato antes da retirada guarda horário, não muda estoque e fica privado', async t => {
    const f = fixture(t), m = await modulePromise;
    await m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report()], now());
    const records = await m.obterDefeitos(f.db, f.p1);
    assert.equal(records.length, 1); assert.equal(records[0].criadoEm, now().toISOString());
    assert.equal(records[0].professorNome, 'Professora Um');
    assert.equal((await m.obterDefeitos(f.db, f.p2)).length, 0);
    assert.equal((await m.obterDefeitos(f.db, f.c1)).length, 1);
    assert.equal(f.sql.prepare('SELECT funcionando FROM equipamentos').get().funcionando, 10);
    assert.equal(f.sql.prepare('SELECT retirada_em FROM reservas').get().retirada_em, null);
});

test('relato exige reserva própria com notebooks durante a aula e dados válidos', async t => {
    const f = fixture(t), m = await modulePromise;
    await assert.rejects(m.alterarDefeito(f.db, f.p2, 'reportNotebookDefect', [report()], now()), { status: 404 });
    for (const date of ['2026-11-19T12:29:59Z', '2026-11-19T13:20:00Z', '2026-11-20T12:35:00Z']) {
        await assert.rejects(m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report()], new Date(date)), { status: 400 });
    }
    for (const data of [report({ etiqueta: ' ' }), report({ descricao: ' ' }), report({ descricao: 'a'.repeat(2001) })]) {
        await assert.rejects(m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [data], now()), { status: 400 });
    }
    f.sql.exec("UPDATE reservas SET situacao='cancelada' WHERE id='r1'");
    await assert.rejects(m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report()], now()), { status: 400 });
});

test('etiqueta repetida não duplica o contador e leitura exige coordenação', async t => {
    const f = fixture(t), m = await modulePromise;
    const result = await m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report()], now());
    await assert.rejects(m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report({ etiqueta: ' nt-01 ' })], now()), { status: 409 });
    await m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report({ etiqueta: 'Á-01' })], now());
    await assert.rejects(m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report({ etiqueta: 'á-01' })], now()), { status: 409 });
    await assert.rejects(m.alterarDefeito(f.db, f.p1, 'markDefectRead', [result.id], now()), { status: 403 });
    assert.equal((await m.obterDefeitos(f.db, f.c1)).filter(d => !d.lidoEm).length, 2);
    await m.alterarDefeito(f.db, f.c1, 'markDefectRead', [result.id], now());
    await m.alterarDefeito(f.db, f.c1, 'markDefectRead', [result.id], new Date('2026-11-19T12:40:00Z'));
    const records = await m.obterDefeitos(f.db, f.c1);
    assert.equal(records.length, 2); assert.equal(records.find(d => d.id === result.id).lidoEm, now().toISOString());
    await assert.rejects(m.alterarDefeito(f.db, f.c1, 'markDefectRead', ['inexistente'], now()), { status: 404 });
});

test('aluno vinculado antes ou depois é sinalizado sem apagar o histórico', async t => {
    const f = fixture(t), m = await modulePromise;
    await m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report()], now());
    assert.equal((await m.obterDefeitos(f.db, f.p1))[0].aluno, '');
    f.sql.prepare("UPDATE reservas SET alunos=? WHERE id='r1'").run(JSON.stringify([{ etiqueta: 'nt-01', aluno: 'Aluno Um' }]));
    assert.equal((await m.obterDefeitos(f.db, f.p1))[0].aluno, 'Aluno Um');
    f.sql.prepare("UPDATE reservas SET alunos=? WHERE id='r1'").run(JSON.stringify([{ etiqueta: 'nt-02', aluno: 'Aluno Dois' }]));
    await m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report({ etiqueta: 'NT-02' })], now());
    f.sql.exec("UPDATE reservas SET situacao='cancelada', alunos='[]' WHERE id='r1'");
    const records = await m.obterDefeitos(f.db, f.p1);
    assert.equal(records.length, 2); assert.equal(records.find(d => d.etiqueta === 'NT-02').aluno, 'Aluno Dois');
});

test('relatos preservam contexto da aula e não são aceitos em período bloqueado', async t => {
    const f = fixture(t), m = await modulePromise;
    await m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report()], now());
    f.sql.exec("UPDATE reservas SET data='2026-11-20' WHERE id='r1'");
    assert.equal((await m.obterDefeitos(f.db, f.p1))[0].data, '2026-11-19');
    f.sql.exec("UPDATE reservas SET data='2026-11-19' WHERE id='r1'; INSERT INTO bloqueios (id,data,data_fim,inicio,fim,motivo,conta_id) VALUES ('b','2026-11-18','2026-11-20','00:00','24:00','','c1');");
    await assert.rejects(m.alterarDefeito(f.db, f.p1, 'reportNotebookDefect', [report({ etiqueta: 'NT-02' })], now()), { status: 409 });
});

test('remoção da sala impede recadastro e preserva reserva histórica', t => {
    const sql = new DatabaseSync(':memory:'); t.after(() => sql.close());
    const directory = join(__dirname, '../migrations');
    for (const file of readdirSync(directory).filter(f => f.endsWith('.sql') && !f.startsWith('0008')).sort()) sql.exec(readFileSync(join(directory, file), 'utf8'));
    sql.exec("INSERT INTO contas (id,email,papel,identidade_externa) VALUES ('p','p@escola.test','professor','firebase:test:p'); INSERT INTO salas VALUES ('maker','Espaço Maker',1); INSERT INTO reservas (id,conta_id,sala_id,data,inicio,fim) VALUES ('history','p','maker','2026-11-18','07:00','07:50');");
    sql.exec(readFileSync(join(directory, '0008_retirar_espaco_maker.sql'), 'utf8'));
    assert.equal(sql.prepare("SELECT ativa FROM salas WHERE id='maker'").get().ativa, 0);
    assert.equal(sql.prepare("SELECT sala_id FROM reservas WHERE id='history'").get().sala_id, 'maker');
    assert.throws(() => sql.exec("UPDATE salas SET ativa=1 WHERE id='maker'"), /SALA_REMOVIDA/);
    assert.throws(() => sql.exec("INSERT INTO salas VALUES ('new','ESPAÇO MAKER',1)"), /SALA_REMOVIDA/);
});
