const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes, createHash } = require('node:crypto');
const worker = import('../src/worker.mjs').then(m => m.default);
const origin = 'https://edulab.test';

function fixture(t) {
    const sql = new DatabaseSync(':memory:'); t.after(() => sql.close());
    for (const f of readdirSync(join(__dirname, '../migrations')).filter(f => f.endsWith('.sql')).sort()) sql.exec(readFileSync(join(__dirname, '../migrations', f), 'utf8'));
    const DB = { prepare(query) {
        const s = sql.prepare(query);
        const bound = params => ({ bind: (...p) => bound(p), first: async () => s.get(...params) ?? null,
            all: async () => ({ results: s.all(...params) }), run: async () => ({ meta: s.run(...params) }) });
        return bound([]);
    }, async batch(items) {
        sql.exec('BEGIN');
        try { const result = []; for (const s of items) result.push(await s.all()); sql.exec('COMMIT'); return result; }
        catch (e) { sql.exec('ROLLBACK'); throw e; }
    } };
    const cookies = {};
    for (const [id, papel] of [['p1', 'professor'], ['p2', 'professor'], ['c1', 'coordenacao']]) {
        sql.prepare('INSERT INTO contas (id, email, papel, identidade_externa) VALUES (?, ?, ?, ?)').run(id, id + '@exemplo.com', papel, 'firebase:test:' + id);
        const token = randomBytes(32).toString('base64url'); cookies[id] = '__Host-alceu_sessao=' + token;
        sql.prepare('INSERT INTO sessoes VALUES (?, ?, ?)').run(createHash('sha256').update(token).digest('base64url'), id, Math.floor(Date.now() / 1000) + 3600);
    }
    sql.exec("INSERT INTO salas VALUES ('r1', 'Laboratório', 1); INSERT INTO equipamentos VALUES ('n1', 'Dell', 10, 2)");
    const request = async (user, path, body, from = origin) => (await worker).fetch(new Request(origin + path, {
        method: body ? 'POST' : 'GET', headers: { ...(user ? { Cookie: cookies[user] } : {}), ...(body ? { Origin: from, 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    }), { DB, ACCOUNT_ORIGIN: origin });
    const action = (user, acao, ...args) => request(user, '/api/agenda/acao', { acao, args });
    const state = async user => (await request(user, '/api/agenda/estado')).json();
    const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return { sql, request, action, state, booking: { data: date, inicio: '07:00', fim: '07:50', sala: 'Laboratório', notebooks: 0 } };
}

test('sistema real exige sessão e origem e decide o professor no servidor', async t => {
    const f = fixture(t);
    assert.equal((await f.request(null, '/api/agenda/estado')).status, 401);
    assert.equal((await f.request('p1', '/api/agenda/acao', { acao: 'addRoom', args: ['Sala'] }, 'https://outro.test')).status, 403);
    assert.equal((await f.action('p1', 'addRoom', 'Sala indevida')).status, 403);
    assert.equal((await f.action('p1', 'createReservation', { ...f.booking, professorId: 'p2', professorNome: 'Nome forjado' })).status, 200);
    const saved = (await f.state('p1')).reservations[0];
    assert.equal(saved.professorId, 'p1'); assert.equal(saved.professorNome, 'p1');
    assert.equal((await f.action('p2', 'cancelReservation', saved.id)).status, 404);
    assert.equal((await f.action('c1', 'cancelReservation', saved.id)).status, 200);
});

test('reservas concorrentes respeitam sala, estoque e intervalos consecutivos', async t => {
    const f = fixture(t);
    const results = await Promise.all([f.action('p1', 'createReservation', f.booking), f.action('p2', 'createReservation', f.booking)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal((await f.action('p2', 'createReservation', { ...f.booking, inicio: '07:50', fim: '08:40' })).status, 200);
    const nb = { ...f.booking, sala: null, notebooks: 6, marca: 'Dell' };
    assert.equal((await f.action('p1', 'createReservation', nb)).status, 200);
    assert.equal((await f.action('p2', 'createReservation', { ...nb, notebooks: 5 })).status, 409);
    assert.equal((await f.action('p2', 'createReservation', { ...nb, inicio: '07:50', fim: '08:40' })).status, 200);
    assert.equal((await f.action('p1', 'createReservation', { ...nb, inicio: '07:00', fim: '08:40', notebooks: 4 })).status, 200);
    assert.equal((await f.action('p1', 'createReservation', { ...nb, notebooks: 1.5 })).status, 400);
});

test('bloqueios e estoque são compartilhados, sem importar dados locais', async t => {
    const f = fixture(t);
    assert.equal((await f.action('c1', 'createBlock', { ...f.booking, motivo: 'Manutenção' })).status, 200);
    assert.equal((await f.action('p1', 'createReservation', f.booking)).status, 409);
    const block = (await f.state('p2')).blocks[0];
    assert.equal(block.motivo, 'Manutenção');
    assert.equal((await f.action('p1', 'deleteBlock', block.id)).status, 403);
    assert.equal((await f.action('c1', 'deleteBlock', block.id)).status, 200);
    assert.equal((await f.action('c1', 'registerNotebookDefect', 'n1', 3)).status, 200);
    assert.equal((await f.state('p1')).notebooks[0].funcionando, 7);
    assert.equal((await f.action('p1', 'addNotebooks', 'Dell', 100)).status, 403);
    assert.equal((await f.action('c1', 'registerNotebookAvailability', 'n1', 6)).status, 409);
});

test('retirada exige coordenação e alunos ficam privados entre professores', async t => {
    const f = fixture(t);
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    f.sql.prepare("INSERT INTO reservas (id, conta_id, data, inicio, fim, notebooks) VALUES ('active', 'p1', ?, '00:00', '23:59', 2)").run(today);
    const assignments = [{ etiqueta: 'NT-1', aluno: 'Aluno de teste' }];
    assert.equal((await f.action('p1', 'saveStudentAssignments', 'active', assignments)).status, 400);
    assert.equal((await f.action('p1', 'confirmPickup', 'active')).status, 403);
    assert.equal((await f.action('c1', 'confirmPickup', 'active')).status, 200);
    assert.equal((await f.action('p2', 'saveStudentAssignments', 'active', assignments)).status, 404);
    assert.equal((await f.action('p1', 'saveStudentAssignments', 'active', [...assignments, ...assignments])).status, 400);
    assert.equal((await f.action('p1', 'saveStudentAssignments', 'active', assignments)).status, 200);
    assert.deepEqual((await f.state('p1')).reservations[0].alunosNotebooks, assignments);
    assert.deepEqual((await f.state('c1')).reservations[0].alunosNotebooks, assignments);
    assert.equal(JSON.stringify(await f.state('p2')).includes('Aluno de teste'), false);
});
