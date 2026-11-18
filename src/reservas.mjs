import { HttpError, json, readJson } from './http.mjs';
import { sessao } from './contas.mjs';

const timezone = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const horaValida = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

function dataValida(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const data = new Date(value + 'T12:00:00Z');
    return Number.isFinite(data.valueOf()) && data.toISOString().slice(0, 10) === value;
}

const idValido = value => typeof value === 'string' && value.length > 0 && value.length <= 100;
const mensagemSala = 'Confira se a sala está ativa e livre nesse horário.';

async function listarAgenda(db, conta, data) {
    const [catalogo, agenda] = await db.batch([
        db.prepare('SELECT id, nome, ativa FROM salas ORDER BY nome COLLATE NOCASE, id'),
        db.prepare(`SELECT r.id, r.sala_id AS salaId, s.nome AS sala, r.inicio, r.fim, (r.conta_id = ?) AS minha
            FROM reservas_salas r JOIN salas s ON s.id = r.sala_id WHERE r.data = ? ORDER BY r.inicio, s.nome`)
            .bind(conta.id, data),
    ]);
    return json({
        salas: catalogo.results.map(row => ({ ...row, ativa: row.ativa === 1 })),
        reservas: agenda.results.map(row => ({ ...row, minha: row.minha === 1 })),
    });
}

export async function rotaReservas(request, env, url) {
    const db = env.DB;
    const conta = await sessao(request, db, url);
    if (!conta) throw new HttpError(401, 'Entre com sua conta para continuar.');
    const path = url.pathname.slice('/api/agenda/'.length);
    if (path === 'salas' && request.method === 'GET') {
        const data = url.searchParams.get('data') ?? timezone.format(new Date()).slice(0, 10);
        if (!dataValida(data)) throw new HttpError(400, 'Informe uma data válida.');
        return listarAgenda(db, conta, data);
    }
    if (request.method !== 'POST') return json({ error: 'Rota não encontrada.' }, 404);
    if (request.headers.get('Origin') !== url.origin) throw new HttpError(403, 'Origem não autorizada.');
    const body = await readJson(request);
    if (path === 'reservar') {
        const { salaId, data, inicio, fim } = body;
        if (!idValido(salaId) || !dataValida(data) || !horaValida(inicio) || !horaValida(fim) || inicio >= fim) {
            throw new HttpError(400, 'Selecione uma sala, uma data e um horário válido.');
        }
        if (`${data} ${inicio}` <= timezone.format(new Date())) {
            throw new HttpError(400, 'Escolha um horário futuro.');
        }
        const id = crypto.randomUUID();
        // A condição e a gravação são uma só instrução SQLite, inclusive para dois pedidos simultâneos.
        const result = await db.prepare(`INSERT INTO reservas_salas (id, sala_id, conta_id, data, inicio, fim)
            SELECT ?, ?, ?, ?, ?, ? FROM salas s WHERE s.id = ? AND s.ativa = 1
            AND NOT EXISTS (SELECT 1 FROM reservas_salas r
                WHERE r.sala_id = s.id AND r.data = ? AND r.inicio < ? AND r.fim > ?)`)
            .bind(id, salaId, conta.id, data, inicio, fim, salaId, data, fim, inicio).run();
        if (result.meta.changes !== 1) throw new HttpError(409, mensagemSala);
        return json({ id }, 201);
    }
    if (path === 'cancelar') {
        if (!idValido(body.id)) throw new HttpError(400, 'Informe uma reserva válida.');
        const result = await db.prepare('DELETE FROM reservas_salas WHERE id = ? AND (conta_id = ? OR ? = 1)')
            .bind(body.id, conta.id, Number(conta.papel === 'coordenacao')).run();
        if (result.meta.changes !== 1) throw new HttpError(404, 'Reserva não encontrada.');
        return json({ ok: true });
    }

    if (conta.papel !== 'coordenacao') throw new HttpError(403, 'Apenas a coordenação gerencia as salas.');
    if (path === 'sala/cadastrar') {
        const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
        if (!nome || nome.length > 100) throw new HttpError(400, 'Informe um nome de sala de até 100 caracteres.');
        const result = await db.prepare('INSERT INTO salas (id, nome) VALUES (?, ?) ON CONFLICT(nome) DO NOTHING')
            .bind(crypto.randomUUID(), nome).run();
        if (result.meta.changes !== 1) throw new HttpError(409, 'Já existe uma sala com este nome.');
        return json({ ok: true }, 201);
    }
    if (path === 'sala/atividade') {
        if (!idValido(body.id) || typeof body.ativa !== 'boolean') throw new HttpError(400, 'Informe a sala e sua situação.');
        const result = await db.prepare('UPDATE salas SET ativa = ? WHERE id = ?').bind(Number(body.ativa), body.id).run();
        if (result.meta.changes !== 1) throw new HttpError(404, 'Sala não encontrada.');
        return json({ ok: true });
    }
    return json({ error: 'Rota não encontrada.' }, 404);
}
