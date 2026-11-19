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
    const next = new Date(Date.now() + 86400000);
    while ([0, 6].includes(next.getUTCDay())) next.setUTCDate(next.getUTCDate() + 1);
    const date = next.toISOString().slice(0, 10);
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

test('servidor rejeita reservas no sábado e domingo', async t => {
    const f = fixture(t);
    const saturday = new Date(f.booking.data + 'T12:00:00Z');
    while (saturday.getUTCDay() !== 6) saturday.setUTCDate(saturday.getUTCDate() + 1);
    for (let day = 0; day < 2; day++) {
        const response = await f.action('p1', 'createReservation', { ...f.booking, data: saturday.toISOString().slice(0, 10) });
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /segunda a sexta/);
        saturday.setUTCDate(saturday.getUTCDate() + 1);
    }
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM reservas').get().n, 0);
});

test('criação usa hora de São Paulo, inclui o minuto 15 e exclui o fim', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-27T10:15:00Z') });
    const f = fixture(t);
    const b = { ...f.booking, data: '2026-10-27', sala: null, notebooks: 1 };
    assert.equal((await f.action('p1', 'createReservation', b)).status, 200);
    assert.equal((await f.action('c1', 'createReservation', { ...b, professorId: 'p2' })).status, 200);
    assert.equal((await f.action('p1', 'createReservation', { ...b, fim: '07:15' })).status, 400);
    const criadaAtrasada = (await f.state('p1')).reservations.find(r => r.professorId === 'p1');
    assert.equal((await f.action('p1', 'updateReservation', criadaAtrasada.id, f.booking)).status, 400);
    t.mock.timers.setTime(Date.parse('2026-10-27T10:16:00Z'));
    assert.equal((await f.action('p1', 'createReservation', b)).status, 400);
});

test('edição própria inclui o minuto 10, preserva o início original e registra antes/depois', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-27T10:09:00Z') });
    const f = fixture(t);
    const b = { ...f.booking, data: '2026-10-27', notebooks: 10, marca: 'Dell', turma: '3º B' };
    const { result: { id } } = await (await f.action('p1', 'createReservation', b)).json();
    assert.equal((await f.action('p2', 'updateReservation', id, b)).status, 404);
    assert.equal((await f.action('c1', 'updateReservation', id, b)).status, 404);
    t.mock.timers.setTime(Date.parse('2026-10-27T10:10:00Z'));
    assert.equal((await f.action('p1', 'updateReservation', id, { ...b, inicio: '06:59' })).status, 400);
    assert.equal((await f.action('p1', 'updateReservation', id, { ...b, turma: '2º A' })).status, 200);
    assert.equal((await f.action('p1', 'updateReservation', id, f.booking)).status, 200);
    const reservation = (await f.state('p1')).reservations.find(r => r.id === id);
    assert.equal(reservation.data, f.booking.data);
    assert.equal(reservation.dataOriginal, b.data);
    assert.equal(reservation.inicioOriginal, b.inicio);
    const audit = f.sql.prepare('SELECT conta_id, antes, depois FROM reservas_alteracoes ORDER BY id').all();
    assert.equal(audit.length, 2);
    assert.equal(audit[0].conta_id, 'p1');
    assert.equal(JSON.parse(audit[0].antes).turma, '3º B');
    assert.equal(JSON.parse(audit[0].depois).turma, '2º A');
    assert.equal(JSON.parse(audit[1].depois).notebooks, 0);
    t.mock.timers.setTime(Date.parse('2026-10-27T10:11:00Z'));
    assert.equal((await f.action('p1', 'updateReservation', id, f.booking)).status, 400);
});

test('edições concorrentes reservam estoque apenas uma vez e retirada impede nova edição', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-27T10:05:00Z') });
    const f = fixture(t);
    const b = { ...f.booking, data: '2026-10-27', sala: null, marca: 'Dell', notebooks: 4 };
    const ids = [];
    for (const professor of ['p1', 'p2']) {
        const { result } = await (await f.action(professor, 'createReservation', b)).json();
        ids.push(result.id);
    }
    const res = await Promise.all(ids.map((id, i) => f.action(`p${i + 1}`, 'updateReservation', id, { ...b, notebooks: 6 })));
    assert.deepEqual(res.map(r => r.status).sort(), [200, 409]);
    assert.equal(f.sql.prepare('SELECT SUM(notebooks) AS n FROM reservas').get().n, 10);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM reservas_alteracoes').get().n, 1);
    assert.equal((await f.action('c1', 'confirmPickup', ids[0])).status, 200);
    assert.equal((await f.action('p1', 'updateReservation', ids[0], f.booking)).status, 409);
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

test('intervalo inclusivo de bloqueio integral preserva a reserva e deixa de sinalizá-la quando removido', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-27T10:05:00Z') });
    const f = fixture(t);
    const b = { ...f.booking, data: '2026-10-27', notebooks: 2 };
    const { result } = await (await f.action('p1', 'createReservation', b)).json();
    assert.equal((await f.action('c1', 'createBlock', { data: b.data, dataFim: '2026-10-29', todosHorarios: true })).status, 200);
    const state = await f.state('p1');
    assert.equal(state.blocks.length, 1);
    assert.equal(state.blocks[0].motivo, '');
    assert.equal(state.blocks[0].todosHorarios, true);
    assert.equal(state.blocks[0].dataFim, '2026-10-29');
    assert.equal(state.reservations[0].situacao, 'confirmada');
    assert.equal(state.reservations[0].bloqueada, true);
    assert.equal((await f.action('c1', 'confirmPickup', result.id)).status, 400);
    assert.equal((await f.action('p1', 'updateReservation', result.id, f.booking)).status, 409);
    for (const day of ['2026-10-28', '2026-10-29']) {
        assert.equal((await f.action('p2', 'createReservation', { ...f.booking, data: day })).status, 409);
    }
    assert.equal((await f.action('p2', 'createReservation', { ...f.booking, data: '2026-10-30' })).status, 200);
    assert.equal((await f.action('c1', 'createBlock', { data: '2026-10-30', dataFim: '2026-10-29', todosHorarios: true })).status, 400);
    assert.equal((await f.action('c1', 'deleteBlock', state.blocks[0].id)).status, 200);
    assert.equal((await f.state('p1')).reservations[0].bloqueada, false);
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
