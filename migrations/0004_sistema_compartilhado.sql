CREATE TABLE equipamentos (
 id TEXT PRIMARY KEY NOT NULL, marca TEXT NOT NULL UNIQUE COLLATE NOCASE,
 funcionando INTEGER NOT NULL DEFAULT 0 CHECK (funcionando >= 0),
 defeito INTEGER NOT NULL DEFAULT 0 CHECK (defeito >= 0)
);
CREATE TABLE bloqueios (
 id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, inicio TEXT NOT NULL,
 fim TEXT NOT NULL CHECK (inicio < fim), motivo TEXT NOT NULL,
 conta_id TEXT NOT NULL REFERENCES contas(id),
 criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX bloqueios_horarios ON bloqueios(data, inicio, fim);
CREATE TABLE reservas (
 id TEXT PRIMARY KEY NOT NULL, conta_id TEXT NOT NULL REFERENCES contas(id), sala_id TEXT REFERENCES salas(id),
 data TEXT NOT NULL, inicio TEXT NOT NULL, fim TEXT NOT NULL CHECK (inicio < fim),
 notebooks INTEGER NOT NULL DEFAULT 0 CHECK (notebooks >= 0), marca TEXT NOT NULL DEFAULT '', turma TEXT NOT NULL DEFAULT '',
 situacao TEXT NOT NULL DEFAULT 'confirmada' CHECK (situacao IN ('confirmada', 'cancelada')),
 retirada_em TEXT, retirada_por TEXT REFERENCES contas(id),
 alunos TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(alunos)),
 criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
 CHECK (sala_id IS NOT NULL OR notebooks > 0)
);
CREATE INDEX reservas_horarios ON reservas(data, inicio, fim);
CREATE INDEX reservas_conta ON reservas(conta_id, data);

INSERT INTO reservas (id, conta_id, sala_id, data, inicio, fim)
SELECT id, conta_id, sala_id, data, inicio, fim FROM reservas_salas;

CREATE TRIGGER reservas_validar BEFORE INSERT ON reservas WHEN NEW.situacao = 'confirmada'
BEGIN
 SELECT RAISE(ABORT, 'SALA_INDISPONIVEL') WHERE NEW.sala_id IS NOT NULL AND
 NOT EXISTS (SELECT 1 FROM salas WHERE id = NEW.sala_id AND ativa = 1);
 SELECT RAISE(ABORT, 'PERIODO_BLOQUEADO') WHERE EXISTS (
 SELECT 1 FROM bloqueios WHERE data = NEW.data AND inicio < NEW.fim AND fim > NEW.inicio);
 SELECT RAISE(ABORT, 'SALA_OCUPADA') WHERE NEW.sala_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM reservas WHERE situacao = 'confirmada' AND sala_id = NEW.sala_id
 AND data = NEW.data AND inicio < NEW.fim AND fim > NEW.inicio);
 SELECT RAISE(ABORT, 'ESTOQUE_INSUFICIENTE') WHERE NEW.notebooks > 0 AND EXISTS (
 SELECT 1 FROM (SELECT NEW.inicio AS hora UNION SELECT inicio FROM reservas
 WHERE data = NEW.data AND situacao = 'confirmada' AND inicio > NEW.inicio AND inicio < NEW.fim) pontos
 WHERE NEW.notebooks + COALESCE((SELECT SUM(notebooks) FROM reservas WHERE data = NEW.data AND situacao = 'confirmada'
 AND inicio <= pontos.hora AND fim > pontos.hora), 0) > COALESCE((SELECT SUM(funcionando) FROM equipamentos), 0));
 SELECT RAISE(ABORT, 'MARCA_INSUFICIENTE') WHERE NEW.notebooks > 0 AND NEW.marca <> '' AND EXISTS (
 SELECT 1 FROM (SELECT NEW.inicio AS hora UNION SELECT inicio FROM reservas
 WHERE data = NEW.data AND situacao = 'confirmada' AND inicio > NEW.inicio AND inicio < NEW.fim) pontos
 WHERE NEW.notebooks + COALESCE((SELECT SUM(notebooks) FROM reservas WHERE data = NEW.data AND situacao = 'confirmada'
 AND marca = NEW.marca COLLATE NOCASE AND inicio <= pontos.hora AND fim > pontos.hora), 0)
 > COALESCE((SELECT funcionando FROM equipamentos WHERE marca = NEW.marca COLLATE NOCASE), 0));
END;
