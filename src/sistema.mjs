import { HttpError, json, readJson } from './http.mjs';
import { nomeDaConta, sessao } from './contas.mjs';
import { obterDefeitos, alterarDefeito } from './defeitos.mjs';

const clock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const coord = conta => conta.papel === 'coordenacao';
const horaValida = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const dataValida = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const minutos = hora => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
function horarioLocal(instante = new Date()) {
    const hora = clock.format(instante);
    return { data: hora.slice(0, 10), ms: minutos(hora.slice(11)) * 60000 + instante.getUTCSeconds() * 1000 + instante.getUTCMilliseconds() };
}
const dentroDaJanela = (data, inicio, limite, agora) => data > agora.data ||
    (data === agora.data && agora.ms <= (minutos(inicio) + limite) * 60000);
const antesDoFim = (data, fim, agora) => data > agora.data ||
    (data === agora.data && agora.ms < minutos(fim) * 60000);
const sobreposicaoBloqueio = (bloqueio, reserva) => `${bloqueio}.data <= ${reserva}.data AND COALESCE(${bloqueio}.data_fim, ${bloqueio}.data) >= ${reserva}.data AND ${bloqueio}.inicio < ${reserva}.fim AND ${bloqueio}.fim > ${reserva}.inicio`;
function exigir(value, message, status = 400) { if (!value) throw new HttpError(status, message); }
function texto(value, max = 100) { return typeof value === 'string' && value.trim().length <= max ? value.trim() : ''; }

async function dadosReserva(db, b) {
    const { data, inicio, fim } = b;
    const notebooks = b.notebooks ?? 0;
    exigir(dataValida(data) && horaValida(inicio) && horaValida(fim) && inicio < fim, 'Informe uma data e horários válidos.');
    const weekday = new Date(data + 'T12:00:00Z').getUTCDay();
    exigir(weekday !== 0 && weekday !== 6, 'As reservas são de segunda a sexta-feira. Escolha um dia letivo.');
    exigir(Number.isInteger(notebooks) && notebooks >= 0 && notebooks <= 1000, 'Informe uma quantidade inteira de até 1000 notebooks.');
    let salaId = null;
    if (b.sala) {
        const sala = await db.prepare('SELECT id FROM salas WHERE nome = ? AND ativa = 1').bind(texto(b.sala)).first();
        exigir(sala, 'Selecione uma sala ativa.');
        salaId = sala.id;
    }
    exigir(salaId || notebooks > 0, 'Selecione uma sala ou notebooks.');
    let marca = notebooks && b.marca !== 'Qualquer marca' ? texto(b.marca) : '';
    if (marca) {
        const equipamento = await db.prepare('SELECT marca FROM equipamentos WHERE marca = ? COLLATE NOCASE').bind(marca).first();
        exigir(equipamento, 'Selecione uma marca cadastrada.');
        marca = equipamento.marca;
    }
    return [salaId, data, inicio, fim, notebooks, marca, texto(b.turma)];
}

export async function estado(db, conta) {
    const hoje = clock.format(new Date()).slice(0, 10);
    const results = await db.batch([
        db.prepare("SELECT id, nome, ativa FROM salas WHERE lower(replace(trim(nome), 'Ç', 'ç')) NOT IN ('espaço maker', 'espaco maker') ORDER BY nome COLLATE NOCASE"),
        db.prepare('SELECT id, marca, funcionando, defeito FROM equipamentos ORDER BY marca COLLATE NOCASE'),
        db.prepare(`SELECT r.id, r.conta_id, r.data, r.inicio, r.fim, r.notebooks, r.marca, r.turma, r.situacao, r.criado_em,
            r.data_original, r.inicio_original, r.retirada_em, s.nome AS sala,
            c.nome AS professor_nome, c.email AS professor_email, p.nome AS retirada_nome, p.email AS retirada_email,
            EXISTS (SELECT 1 FROM bloqueios b WHERE ${sobreposicaoBloqueio('b', 'r')}) AS bloqueada,
            CASE WHEN r.conta_id = ? OR ? = 1 THEN r.alunos ELSE '[]' END AS alunos_visiveis
            FROM reservas r JOIN contas c ON c.id = r.conta_id LEFT JOIN salas s ON s.id = r.sala_id
            LEFT JOIN contas p ON p.id = r.retirada_por WHERE r.data >= ? ORDER BY r.data, r.inicio, r.id`)
            .bind(conta.id, Number(coord(conta)), hoje),
        db.prepare(`SELECT b.*, c.nome, c.email FROM bloqueios b JOIN contas c ON c.id = b.conta_id
            WHERE COALESCE(b.data_fim, b.data) >= ? ORDER BY b.data, b.inicio`).bind(hoje),
        coord(conta) ? db.prepare("SELECT id, nome, email FROM contas WHERE ativa = 1 AND papel = 'professor' ORDER BY COALESCE(nome, email)") : db.prepare('SELECT id, nome, email FROM contas WHERE id = ?').bind(conta.id),
    ]);
    return {
        session: { userId: conta.id, email: conta.email, nome: conta.nome, role: conta.papel, avatarLetter: Array.from(conta.nome)[0].toUpperCase() },
        rooms: results[0].results.map(r => ({ ...r, ativa: Boolean(r.ativa) })),
        notebooks: results[1].results.map(r => ({ ...r, total: r.funcionando + r.defeito })),
        reservations: results[2].results.map(r => ({ id: r.id, professorId: r.conta_id, professorNome: nomeDaConta(r.professor_nome, r.professor_email), sala: r.sala,
            data: r.data, inicio: r.inicio, fim: r.fim, notebooks: r.notebooks, marca: r.marca || 'Qualquer marca', turma: r.turma, situacao: r.situacao, criadoEm: r.criado_em,
            dataOriginal: r.data_original ?? r.data, inicioOriginal: r.inicio_original ?? r.inicio,
            bloqueada: r.situacao === 'confirmada' && Boolean(r.bloqueada),
            retiradaConfirmada: Boolean(r.retirada_em), retiradaConfirmadaEm: r.retirada_em, retiradaConfirmadaPor: r.retirada_email ? nomeDaConta(r.retirada_nome, r.retirada_email) : '',
            alunosNotebooks: JSON.parse(r.alunos_visiveis), alunosRegistrados: r.alunos_visiveis !== '[]' })),
        blocks: results[3].results.map(b => ({ id: b.id, data: b.data, dataFim: b.data_fim ?? b.data, inicio: b.inicio, fim: b.fim,
            todosHorarios: b.inicio === '00:00' && b.fim === '24:00', motivo: b.motivo, criadoPor: nomeDaConta(b.nome, b.email), criadoEm: b.criado_em })),
        professors: results[4].results.map(c => ({ id: c.id, nome: nomeDaConta(c.nome, c.email) })),
        defects: await obterDefeitos(db, conta),
    };
}

export async function alterar(db, conta, acao, args) {
    if (['reportNotebookDefect', 'markDefectRead'].includes(acao)) return alterarDefeito(db, conta, acao, args);
    const [first, second] = args;
    if (acao === 'createReservation') {
        const b = first || {};
        const dados = await dadosReserva(db, b);
        const professorId = coord(conta) && b.professorId ? texto(b.professorId) : conta.id;
        exigir(await db.prepare("SELECT id FROM contas WHERE id = ? AND ativa = 1 AND papel = 'professor'").bind(professorId).first(), 'Selecione um professor ativo.');
        const agora = horarioLocal();
        exigir(dentroDaJanela(b.data, b.inicio, 15, agora) && antesDoFim(b.data, b.fim, agora),
            'A reserva pode ser criada até 15 minutos após o início e antes do fim do horário.');
        const id = crypto.randomUUID();
        await db.prepare('INSERT INTO reservas (id, conta_id, sala_id, data, inicio, fim, notebooks, marca, turma, data_original, inicio_original) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(id, professorId, ...dados, b.data, b.inicio).run();
        return { ok: true, id };
    }
    if (acao === 'updateReservation') {
        const r = await db.prepare(`SELECT * FROM reservas WHERE id = ? AND conta_id = ? AND situacao = 'confirmada'`)
            .bind(texto(first), conta.id).first();
        exigir(r, 'Reserva própria confirmada não encontrada.', 404);
        exigir(!r.retirada_em, 'A retirada já foi confirmada para esta reserva.', 409);
        const b = second || {};
        const dados = await dadosReserva(db, b);
        const agora = horarioLocal();
        exigir(dentroDaJanela(r.data_original ?? r.data, r.inicio_original ?? r.inicio, 10, agora) &&
            dentroDaJanela(r.data, r.inicio, 10, agora) && antesDoFim(r.data, r.fim, agora),
            'O prazo para editar terminou. A edição é permitida até 10 minutos após o início original ou atual, valendo o primeiro prazo a vencer.');
        exigir(dentroDaJanela(b.data, b.inicio, 10, agora) && antesDoFim(b.data, b.fim, agora),
            'Para editar, escolha um horário dentro do prazo de 10 minutos após o início e antes do fim.');
        const result = await db.prepare(`UPDATE reservas SET sala_id = ?, data = ?, inicio = ?, fim = ?, notebooks = ?, marca = ?, turma = ?,
            data_original = COALESCE(data_original, data), inicio_original = COALESCE(inicio_original, inicio)
            WHERE id = ? AND conta_id = ? AND situacao = 'confirmada' AND retirada_em IS NULL
            AND sala_id IS ? AND data = ? AND inicio = ? AND fim = ? AND notebooks = ? AND marca = ? AND turma = ?`)
            .bind(...dados, r.id, conta.id, r.sala_id, r.data, r.inicio, r.fim, r.notebooks, r.marca, r.turma).run();
        exigir(result.meta.changes, 'A reserva mudou. Atualize a agenda antes de editar.', 409);
        return { ok: true, id: r.id };
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
        exigir(!await db.prepare(`SELECT 1 FROM reservas r WHERE r.id = ? AND EXISTS (
            SELECT 1 FROM bloqueios b WHERE ${sobreposicaoBloqueio('b', 'r')})`).bind(r.id).first(), 'Reserva indisponível por bloqueio.');
        exigir(r.notebooks > 0, 'Esta reserva não possui notebooks.');
        if (acao === 'confirmPickup') {
            exigir(coord(conta), 'Apenas a coordenação confirma a retirada.', 403);
            const result = await db.prepare(`UPDATE reservas SET retirada_em = COALESCE(retirada_em, ?), retirada_por = COALESCE(retirada_por, ?)
                WHERE id = ? AND situacao = 'confirmada' AND data = ? AND inicio = ? AND fim = ?
                AND notebooks = ? AND marca = ? AND sala_id IS ? AND turma = ? AND NOT EXISTS (
                SELECT 1 FROM bloqueios b WHERE ${sobreposicaoBloqueio('b', 'reservas')})`)
                .bind(new Date().toISOString(), conta.id, r.id, r.data, r.inicio, r.fim, r.notebooks, r.marca, r.sala_id, r.turma).run();
            exigir(result.meta.changes, 'A reserva mudou. Atualize a agenda antes de confirmar a retirada.', 409);
        } else {
            exigir(r.retirada_em, 'Aguarde a confirmação da retirada pela coordenação.');
            exigir(Array.isArray(second) && second.length > 0 && second.length <= r.notebooks, 'Confira a quantidade de alunos e notebooks da reserva.');
            const alunos = second.map(a => ({ etiqueta: texto(a?.etiqueta, 100), aluno: texto(a?.aluno, 200) }));
            exigir(alunos.every(a => a.etiqueta && a.aluno) && new Set(alunos.map(a => a.etiqueta.toLowerCase())).size === alunos.length, 'Informe alunos e etiquetas únicas.');
            const result = await db.prepare(`UPDATE reservas SET alunos = ? WHERE id = ? AND situacao = 'confirmada'
                AND retirada_em IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM bloqueios b WHERE ${sobreposicaoBloqueio('b', 'reservas')})`)
                .bind(JSON.stringify(alunos), r.id).run();
            exigir(result.meta.changes, 'Reserva cancelada ou bloqueada. Atualize a agenda.', 409);
        }
        return { ok: true };
    }
    exigir(coord(conta), 'Apenas a coordenação pode gerenciar recursos e bloqueios.', 403);
    if (acao === 'addRoom') {
        const name = texto(first); exigir(name, 'Informe o nome da sala.');
        exigir(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() !== 'espaco maker', 'Esta sala não faz parte da escola.');
        const result = await db.prepare('INSERT INTO salas (id, nome) VALUES (?, ?) ON CONFLICT(nome) DO NOTHING').bind(crypto.randomUUID(), name).run();
        exigir(result.meta.changes, 'Já existe uma sala com este nome.', 409);
    } else if (acao === 'toggleRoom') {
        const result = await db.prepare('UPDATE salas SET ativa = 1 - ativa WHERE id = ?').bind(texto(first)).run();
        exigir(result.meta.changes, 'Sala não encontrada.', 404);
    } else if (acao === 'createBlock') {
        const b = first || {};
        const dataFim = b.dataFim ?? b.data;
        exigir(dataValida(b.data) && dataValida(dataFim) && b.data <= dataFim && b.data >= clock.format(new Date()).slice(0, 10),
            'Informe um intervalo de datas válido, a partir de hoje.');
        const inicio = b.todosHorarios === true ? '00:00' : b.inicio;
        const fim = b.todosHorarios === true ? '24:00' : b.fim;
        exigir(b.todosHorarios === true || (horaValida(inicio) && horaValida(fim) && inicio < fim), 'Informe horários válidos para o bloqueio.');
        exigir(b.motivo == null || (typeof b.motivo === 'string' && b.motivo.trim().length <= 500), 'Informe um motivo de até 500 caracteres.');
        await db.prepare('INSERT INTO bloqueios (id, conta_id, data, data_fim, inicio, fim, motivo) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(crypto.randomUUID(), conta.id, b.data, dataFim, inicio, fim, texto(b.motivo, 500)).run();
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
        const messages = {
            SALA_REMOVIDA: 'Esta sala não faz parte da escola.',
            SALA_INDISPONIVEL: 'Sala inativa ou inexistente.',
            PERIODO_BLOQUEADO: 'Período bloqueado pela coordenação.',
            SALA_OCUPADA: 'Esta sala já está reservada neste horário.',
            ESTOQUE_INSUFICIENTE: 'Notebooks insuficientes para este horário.',
            MARCA_INSUFICIENTE: 'Notebooks insuficientes da marca escolhida.',
        };
        for (const [code, message] of Object.entries(messages)) if (String(error.message).includes(code)) throw new HttpError(409, message);
        throw error;
    }
    return json({ result });
}
