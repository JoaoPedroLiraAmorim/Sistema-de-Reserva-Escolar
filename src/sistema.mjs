import { HttpError, json, readJson } from './http.mjs';
import { sessao } from './contas.mjs';

const clock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const nome = email => email.split('@')[0];
const coord = conta => conta.papel === 'coordenacao';
function exigir(value, message, status = 400) { if (!value) throw new HttpError(status, message); }
function texto(value, max = 100) { return typeof value === 'string' && value.trim().length <= max ? value.trim() : ''; }
function periodo(b, futuro = true) {
    const { data, inicio, fim } = b;
    exigir(typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data) && Number.isFinite(Date.parse(data)) && new Date(data).toISOString().slice(0, 10) === data &&
        typeof inicio === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(inicio) && typeof fim === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(fim) && inicio < fim, 'Informe uma data e horários válidos.');
    if (futuro) exigir(`${data} ${inicio}` > clock.format(new Date()), 'Escolha uma data e um horário futuros.');
}

export async function estado(db, conta) {
    const results = await db.batch([
        db.prepare('SELECT id, nome, ativa FROM salas ORDER BY nome COLLATE NOCASE'),
        db.prepare('SELECT id, marca, funcionando, defeito FROM equipamentos ORDER BY marca COLLATE NOCASE'),
        db.prepare(`SELECT r.id, r.conta_id, r.data, r.inicio, r.fim, r.notebooks, r.marca, r.turma, r.situacao, r.criado_em,
            r.retirada_em, s.nome AS sala, c.email AS professor_email, p.email AS retirada_email,
            CASE WHEN r.conta_id = ? OR ? = 1 THEN r.alunos ELSE '[]' END AS alunos_visiveis
            FROM reservas r JOIN contas c ON c.id = r.conta_id LEFT JOIN salas s ON s.id = r.sala_id
            LEFT JOIN contas p ON p.id = r.retirada_por WHERE r.data >= ? ORDER BY r.data, r.inicio, r.id`)
            .bind(conta.id, Number(coord(conta)), clock.format(new Date()).slice(0, 10)),
        db.prepare(`SELECT b.*, c.email FROM bloqueios b JOIN contas c ON c.id = b.conta_id WHERE b.data >= ? ORDER BY b.data, b.inicio`)
            .bind(clock.format(new Date()).slice(0, 10)),
        coord(conta) ? db.prepare("SELECT id, email FROM contas WHERE ativa = 1 AND papel = 'professor' ORDER BY email") : db.prepare('SELECT id, email FROM contas WHERE id = ?').bind(conta.id),
    ]);
    return {
        session: { userId: conta.id, email: conta.email, nome: nome(conta.email), role: conta.papel, avatarLetter: nome(conta.email)[0].toUpperCase() },
        rooms: results[0].results.map(r => ({ ...r, ativa: Boolean(r.ativa) })),
        notebooks: results[1].results.map(r => ({ ...r, total: r.funcionando + r.defeito })),
        reservations: results[2].results.map(r => ({ id: r.id, professorId: r.conta_id, professorNome: nome(r.professor_email), sala: r.sala,
            data: r.data, inicio: r.inicio, fim: r.fim, notebooks: r.notebooks, marca: r.marca || 'Qualquer marca', turma: r.turma, situacao: r.situacao, criadoEm: r.criado_em,
            retiradaConfirmada: Boolean(r.retirada_em), retiradaConfirmadaEm: r.retirada_em, retiradaConfirmadaPor: r.retirada_email ? nome(r.retirada_email) : '',
            alunosNotebooks: JSON.parse(r.alunos_visiveis), alunosRegistrados: r.alunos_visiveis !== '[]' })),
        blocks: results[3].results.map(b => ({ id: b.id, data: b.data, inicio: b.inicio, fim: b.fim, motivo: b.motivo, criadoPor: nome(b.email), criadoEm: b.criado_em })),
        professors: results[4].results.map(c => ({ id: c.id, nome: nome(c.email) })),
    };
}

export async function alterar(db, conta, acao, args) {
    const [first, second] = args;
    if (acao === 'createReservation') {
        const b = first || {}; periodo(b);
        const weekday = new Date(b.data + 'T12:00:00Z').getUTCDay();
        exigir(weekday !== 0 && weekday !== 6, 'As reservas são de segunda a sexta-feira. Escolha um dia letivo.');
        const notebooks = b.notebooks ?? 0;
        exigir(Number.isInteger(notebooks) && notebooks >= 0 && notebooks <= 1000, 'Informe uma quantidade inteira de até 1000 notebooks.');
        let salaId = null;
        if (b.sala) {
            const sala = await db.prepare('SELECT id FROM salas WHERE nome = ? AND ativa = 1').bind(texto(b.sala)).first();
            exigir(sala, 'Selecione uma sala ativa.'); salaId = sala.id;
        }
        exigir(salaId || notebooks > 0, 'Selecione uma sala ou notebooks.');
        const professorId = coord(conta) && b.professorId ? texto(b.professorId) : conta.id;
        exigir(await db.prepare("SELECT id FROM contas WHERE id = ? AND ativa = 1 AND papel = 'professor'").bind(professorId).first(), 'Selecione um professor ativo.');
        const id = crypto.randomUUID();
        let marca = notebooks && b.marca !== 'Qualquer marca' ? texto(b.marca) : '';
        if (marca) {
            const equipamento = await db.prepare('SELECT marca FROM equipamentos WHERE marca = ? COLLATE NOCASE').bind(marca).first();
            exigir(equipamento, 'Selecione uma marca cadastrada.'); marca = equipamento.marca;
        }
        await db.prepare('INSERT INTO reservas (id, conta_id, sala_id, data, inicio, fim, notebooks, marca, turma) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(id, professorId, salaId, b.data, b.inicio, b.fim, notebooks, marca, texto(b.turma)).run();
        return { ok: true, id };
    }
    if (['cancelReservation', 'confirmPickup', 'saveStudentAssignments'].includes(acao)) {
        const r = await db.prepare("SELECT * FROM reservas WHERE id = ? AND situacao = 'confirmada'").bind(texto(first)).first();
        exigir(r && (r.conta_id === conta.id || coord(conta)), 'Reserva não encontrada.', 404);
        if (acao === 'cancelReservation') {
            await db.prepare("UPDATE reservas SET situacao = 'cancelada', alunos = '[]' WHERE id = ?").bind(r.id).run();
            return { ok: true };
        }
        const now = clock.format(new Date());
        exigir(r.data === now.slice(0, 10) && r.inicio <= now.slice(11) && r.fim > now.slice(11), 'O registro só está disponível durante o horário da reserva.');
        exigir(!await db.prepare('SELECT id FROM bloqueios WHERE data = ? AND inicio < ? AND fim > ?').bind(r.data, r.fim, r.inicio).first(), 'Reserva indisponível por bloqueio.');
        exigir(r.notebooks > 0, 'Esta reserva não possui notebooks.');
        if (acao === 'confirmPickup') {
            exigir(coord(conta), 'Apenas a coordenação confirma a retirada.', 403);
            const result = await db.prepare(`UPDATE reservas SET retirada_em = COALESCE(retirada_em, ?), retirada_por = COALESCE(retirada_por, ?)
                WHERE id = ? AND situacao = 'confirmada' AND NOT EXISTS (
                SELECT 1 FROM bloqueios b WHERE b.data = reservas.data AND b.inicio < reservas.fim AND b.fim > reservas.inicio)`)
                .bind(new Date().toISOString(), conta.id, r.id).run();
            exigir(result.meta.changes, 'Reserva cancelada ou bloqueada. Atualize a agenda.', 409);
        } else {
            exigir(r.retirada_em, 'Aguarde a confirmação da retirada pela coordenação.');
            exigir(Array.isArray(second) && second.length > 0 && second.length <= r.notebooks, 'Confira a quantidade de alunos e notebooks da reserva.');
            const alunos = second.map(a => ({ etiqueta: texto(a?.etiqueta, 100), aluno: texto(a?.aluno, 200) }));
            exigir(alunos.every(a => a.etiqueta && a.aluno) && new Set(alunos.map(a => a.etiqueta.toLowerCase())).size === alunos.length, 'Informe alunos e etiquetas únicas.');
            const result = await db.prepare(`UPDATE reservas SET alunos = ? WHERE id = ? AND situacao = 'confirmada'
                AND retirada_em IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM bloqueios b WHERE b.data = reservas.data AND b.inicio < reservas.fim AND b.fim > reservas.inicio)`)
                .bind(JSON.stringify(alunos), r.id).run();
            exigir(result.meta.changes, 'Reserva cancelada ou bloqueada. Atualize a agenda.', 409);
        }
        return { ok: true };
    }
    exigir(coord(conta), 'Apenas a coordenação pode gerenciar recursos e bloqueios.', 403);
    if (acao === 'addRoom') {
        const name = texto(first); exigir(name, 'Informe o nome da sala.');
        const result = await db.prepare('INSERT INTO salas (id, nome) VALUES (?, ?) ON CONFLICT(nome) DO NOTHING').bind(crypto.randomUUID(), name).run();
        exigir(result.meta.changes, 'Já existe uma sala com este nome.', 409);
    } else if (acao === 'toggleRoom') {
        const result = await db.prepare('UPDATE salas SET ativa = 1 - ativa WHERE id = ?').bind(texto(first)).run();
        exigir(result.meta.changes, 'Sala não encontrada.', 404);
    } else if (acao === 'createBlock') {
        const b = first || {}; periodo(b, false);
        exigir(b.data >= clock.format(new Date()).slice(0, 10) && texto(b.motivo, 500), 'Informe uma data atual ou futura e o motivo.');
        await db.prepare('INSERT INTO bloqueios (id, conta_id, data, inicio, fim, motivo) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), conta.id, b.data, b.inicio, b.fim, texto(b.motivo, 500)).run();
    } else if (acao === 'deleteBlock') {
        const result = await db.prepare('DELETE FROM bloqueios WHERE id = ?').bind(texto(first)).run();
        exigir(result.meta.changes, 'Bloqueio não encontrado.', 404);
    } else if (acao === 'addNotebooks') {
        exigir(texto(first) && Number.isInteger(second) && second > 0 && second <= 1000, 'Informe uma marca e uma quantidade de até 1000 notebooks.');
        await db.prepare('INSERT INTO equipamentos (id, marca, funcionando) VALUES (?, ?, ?) ON CONFLICT(marca) DO UPDATE SET funcionando = funcionando + excluded.funcionando').bind(crypto.randomUUID(), texto(first), second).run();
    } else if (['registerNotebookDefect', 'registerNotebookAvailability'].includes(acao)) {
        exigir(Number.isInteger(second) && second > 0 && second <= 1000, 'Informe uma quantidade inteira válida.');
        const defect = acao === 'registerNotebookDefect';
        const result = await db.prepare(`UPDATE equipamentos SET funcionando = funcionando + ?, defeito = defeito - ?
            WHERE (id = ? OR marca = ? COLLATE NOCASE) AND ${defect ? 'funcionando' : 'defeito'} >= ?`).bind(defect ? -second : second, defect ? -second : second, texto(first), texto(first), second).run();
        exigir(result.meta.changes, 'Quantidade indisponível nesta marca.', 409);
    } else throw new HttpError(404, 'Ação não encontrada.');
    return { ok: true };
}

export async function rotaReservas(request, env, url) {
    const conta = await sessao(request, env.DB, url);
    exigir(conta, 'Entre com sua conta para continuar.', 401);
    const path = url.pathname.slice('/api/agenda/'.length);
    if (request.method === 'GET' && path === 'estado') return json(await estado(env.DB, conta));
    if (request.method !== 'POST' || path !== 'acao') return json({ error: 'Rota não encontrada.' }, 404);
    exigir(request.headers.get('Origin') === url.origin, 'Origem não autorizada.', 403);
    const body = await readJson(request);
    exigir(typeof body.acao === 'string' && Array.isArray(body.args) && body.args.length <= 3, 'Ação inválida.');
    let result;
    try { result = await alterar(env.DB, conta, body.acao, body.args); }
    catch (error) {
        const messages = { SALA_INDISPONIVEL: 'Sala inativa ou inexistente.', PERIODO_BLOQUEADO: 'Período bloqueado pela coordenação.', SALA_OCUPADA: 'Esta sala já está reservada neste horário.', ESTOQUE_INSUFICIENTE: 'Notebooks insuficientes para este horário.', MARCA_INSUFICIENTE: 'Notebooks insuficientes da marca escolhida.' };
        for (const [code, message] of Object.entries(messages)) if (String(error.message).includes(code)) throw new HttpError(409, message);
        throw error;
    }
    return json({ result });
}
