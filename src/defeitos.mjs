import { HttpError } from './http.mjs';

const clock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const coord = conta => conta.papel === 'coordenacao';
const clean = (value, max) => typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
const normalizedTag = value => value.trim().toLocaleLowerCase('pt-BR');

export async function obterDefeitos(db, conta) {
    const { results } = await db.prepare(`SELECT d.*, r.data, r.inicio, r.fim, r.turma, r.marca, r.alunos,
        c.email, c.nome AS professor_nome, s.nome AS sala
        FROM defeitos_reportados d JOIN reservas r ON r.id = d.reserva_id
        JOIN contas c ON c.id = d.conta_id LEFT JOIN salas s ON s.id = r.sala_id
        WHERE d.conta_id = ? OR ? = 1 ORDER BY d.criado_em DESC, d.id`)
        .bind(conta.id, Number(coord(conta))).all();
    return results.map(d => ({
        id: d.id, reservaId: d.reserva_id, professorId: d.conta_id,
        professorNome: d.professor_nome || d.email.split('@')[0], etiqueta: d.etiqueta, descricao: d.descricao,
        aluno: JSON.parse(d.alunos).find(a => normalizedTag(a.etiqueta) === normalizedTag(d.etiqueta))?.aluno || d.aluno_no_relato,
        criadoEm: d.criado_em, lidoEm: d.lido_em, ...JSON.parse(d.contexto),
    }));
}

export async function alterarDefeito(db, conta, acao, args, now = new Date()) {
    if (acao === 'markDefectRead') {
        if (!coord(conta)) throw new HttpError(403, 'Apenas a coordenação pode marcar relatos como lidos.');
        const id = clean(args[0], 100);
        const result = await db.prepare(`UPDATE defeitos_reportados
            SET lido_em = COALESCE(lido_em, ?), lido_por = COALESCE(lido_por, ?) WHERE id = ?`)
            .bind(now.toISOString(), conta.id, id).run();
        if (!result.meta.changes) throw new HttpError(404, 'Relato não encontrado.');
        return { ok: true };
    }
    const data = args[0] || {};
    const reservaId = clean(data.reservaId, 100);
    const etiqueta = clean(data.etiqueta, 100);
    const descricao = clean(data.descricao, 2000);
    if (!reservaId || !etiqueta || !descricao) throw new HttpError(400, 'Informe a reserva, a etiqueta e a descrição do defeito (até 2000 caracteres).');
    const r = await db.prepare('SELECT * FROM reservas WHERE id = ? AND conta_id = ?').bind(reservaId, conta.id).first();
    if (!r || conta.papel !== 'professor') throw new HttpError(404, 'Reserva não encontrada.');
    const local = clock.format(now), date = local.slice(0, 10), time = local.slice(11);
    if (r.situacao !== 'confirmada' || r.notebooks <= 0 || r.data !== date || r.inicio > time || r.fim <= time) {
        throw new HttpError(400, 'Reporte defeitos durante o horário de sua reserva ativa com notebooks.');
    }
    const id = crypto.randomUUID();
    const aluno = JSON.parse(r.alunos).find(a => normalizedTag(a.etiqueta) === normalizedTag(etiqueta))?.aluno || '';

    const result = await db.prepare(`INSERT INTO defeitos_reportados
        (id, reserva_id, conta_id, etiqueta, etiqueta_normalizada, descricao, aluno_no_relato, contexto, criado_em)
        SELECT ?, id, conta_id, ?, ?, ?, ?, json_object('data', data, 'inicio', inicio, 'fim', fim,
            'turma', turma, 'marca', marca, 'sala', (SELECT nome FROM salas WHERE id = reservas.sala_id)), ? FROM reservas
        WHERE id = ? AND conta_id = ? AND situacao = 'confirmada' AND notebooks > 0
        AND data = ? AND inicio <= ? AND fim > ?
        AND NOT EXISTS (SELECT 1 FROM bloqueios WHERE data <= reservas.data AND COALESCE(data_fim, data) >= reservas.data
            AND inicio < reservas.fim AND fim > reservas.inicio)
        ON CONFLICT(reserva_id, etiqueta_normalizada) DO NOTHING`)
        .bind(id, etiqueta, normalizedTag(etiqueta), descricao, aluno, now.toISOString(), reservaId, conta.id, date, time, time).run();
    if (!result.meta.changes) throw new HttpError(409, 'Já existe um relato para esta etiqueta nesta reserva, ou a reserva foi alterada. Atualize a tela.');
    return { ok: true, id };
}
