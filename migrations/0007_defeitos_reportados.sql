CREATE TABLE defeitos_reportados (
 id TEXT PRIMARY KEY NOT NULL,
 reserva_id TEXT NOT NULL REFERENCES reservas(id),
 conta_id TEXT NOT NULL REFERENCES contas(id),
 etiqueta TEXT NOT NULL CHECK (length(trim(etiqueta)) BETWEEN 1 AND 100),
 etiqueta_normalizada TEXT NOT NULL,
 descricao TEXT NOT NULL CHECK (length(trim(descricao)) BETWEEN 1 AND 2000),
 aluno_no_relato TEXT NOT NULL DEFAULT '',
 contexto TEXT NOT NULL CHECK (json_valid(contexto)),
 criado_em TEXT NOT NULL,
 lido_em TEXT,
 lido_por TEXT REFERENCES contas(id),
 UNIQUE (reserva_id, etiqueta_normalizada)
);
CREATE INDEX defeitos_por_conta ON defeitos_reportados(conta_id, criado_em);
CREATE INDEX defeitos_nao_lidos ON defeitos_reportados(lido_em, criado_em);
