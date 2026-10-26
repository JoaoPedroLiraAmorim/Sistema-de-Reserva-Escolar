const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture() {
    const items = new Map();
    const save = (key, value) => items.set(key, JSON.stringify(value));
    save('ers_seeded_v6', true);
    save('ers_notebooks', [
        { id: 'dell', marca: 'Dell', total: 16, funcionando: 16, defeito: 0 },
        { id: 'lenovo', marca: 'Lenovo', total: 38, funcionando: 38, defeito: 0 }
    ]);
    save('ers_users', [{ id: 'u1', nome: 'Professor', role: 'professor' }]);
    const timers = [];
    const events = [];
    const context = {
        console, Event,
        Date: class extends Date {
            constructor(...args) { super(...(args.length ? args : [2026, 9, 26, 6, 0])); }
        },
        localStorage: { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) },
        window: { addEventListener() {}, dispatchEvent: event => events.push(event.type) },
        document: { addEventListener() {} },
        setInterval: callback => timers.push(callback)
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(require.resolve('../js/store.js'), 'utf8'), context);
    return { store: context.window.ERS, save, items, timers, events };
}

const reservation = overrides => ({ professorId: 'u1', professorNome: 'Professor', data: '2026-10-27', inicio: '07:00', fim: '07:50', notebooks: 1, ...overrides });

test('reservas consecutivas não são somadas como se fossem simultâneas', () => {
    const { store } = fixture();
    assert.equal(store.createReservation(reservation({ notebooks: 30 })).ok, true);
    assert.equal(store.createReservation(reservation({ inicio: '07:50', fim: '08:40', notebooks: 30 })).ok, true);
    assert.equal(store.getAvailability({ data: '2026-10-27', inicio: '07:00', fim: '08:40' }), 24);
    assert.equal(store.createReservation(reservation({ fim: '08:40', notebooks: 24 })).ok, true);
    assert.equal(store.createReservation(reservation()).ok, false);
});

test('marca é persistida e respeita o estoque disponível', () => {
    const { store } = fixture();
    assert.equal(store.createReservation(reservation({ marca: 'Dell', notebooks: 17 })).ok, false);
    const result = store.createReservation(reservation({ marca: 'Dell', notebooks: 16 }));
    assert.equal(result.ok, true);
    assert.equal(result.reservation.marca, 'Dell');
    assert.equal(store.createReservation(reservation({ marca: 'Dell' })).ok, false);
    assert.equal(store.createReservation(reservation({ marca: 'Lenovo' })).ok, true);
});

test('bloqueio sobrepõe reservas existentes e impede novas reservas', () => {
    const { store } = fixture();
    assert.equal(store.createReservation(reservation()).ok, true);
    assert.equal(store.createBlock({ data: '2026-10-27', inicio: '07:00', fim: '08:40', motivo: 'Manutenção', criadoPor: 'Coordenação' }).ok, true);
    assert.equal(store.createReservation(reservation()).ok, false);
    assert.equal(store.getReservations().length, 1);
    assert.equal(store.confirmPickup(store.getReservations()[0].id).ok, false);
    assert.equal(store.saveStudentAssignments(store.getReservations()[0].id, []).ok, false);
});

test('exclusão ocorre no término e preserva reservas ainda em andamento ou futuras', () => {
    const { store, save, items } = fixture();
    save('ers_reservations', [
        reservation({ id: 'ontem', data: '2026-10-25', alunosNotebooks: [{ aluno: 'Exemplo' }] }),
        reservation({ id: 'terminou', data: '2026-10-26', inicio: '05:00', fim: '06:00' }),
        reservation({ id: 'andamento', data: '2026-10-26', inicio: '05:00', fim: '06:10' }),
        reservation({ id: 'futura' })
    ]);
    assert.deepEqual(Array.from(store.getReservations(), r => r.id), ['andamento', 'futura']);
    assert.deepEqual(JSON.parse(items.get('ers_reservations')).map(r => r.id), ['andamento', 'futura']);
    assert.equal(items.get('ers_reservations').includes('alunosNotebooks'), false);
});

test('limpeza periódica avisa as telas quando exclui uma reserva', () => {
    const { save, timers, events } = fixture();
    save('ers_reservations', [reservation({ data: '2026-10-25' })]);
    timers[0]();
    assert.deepEqual(events, ['ers:reservations-updated']);
});

test('sessão legada de gestão migra para coordenação', () => {
    const { store, save } = fixture();
    save('ers_session', { userId: 'u2', role: 'proatec' });
    assert.equal(store.getSession().role, 'coordenacao');
});

test('não aceita início passado ou quantidade fracionária', () => {
    const { store } = fixture();
    assert.equal(store.createReservation(reservation({ data: '2026-10-26', inicio: '05:00' })).ok, false);
    assert.equal(store.createReservation(reservation({ notebooks: 1.5 })).ok, false);
});
