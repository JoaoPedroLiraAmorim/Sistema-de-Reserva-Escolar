ALTER TABLE bloqueios ADD COLUMN data_fim TEXT CHECK (data_fim >= data);
ALTER TABLE reservas ADD COLUMN data_original TEXT;
ALTER TABLE reservas ADD COLUMN inicio_original TEXT;

CREATE TABLE reservas_alteracoes (
 id INTEGER PRIMARY KEY,
 reserva_id TEXT NOT NULL REFERENCES reservas(id),
 conta_id TEXT NOT NULL REFERENCES contas(id),
 alterada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
 antes TEXT NOT NULL CHECK (json_valid(antes)),
 depois TEXT NOT NULL CHECK (json_valid(depois))
);
CREATE INDEX reservas_alteracoes_reserva ON reservas_alteracoes(reserva_id, id);

-- As validações ocorrem na gravação e veem o estado mais recente do banco.
DROP TRIGGER reservas_validar;
CREATE TRIGGER reservas_validar BEFORE INSERT ON reservas WHEN NEW.situacao = 'confirmada'
BEGIN
 SELECT RAISE(ABORT, 'SALA_INDISPONIVEL') WHERE NEW.sala_id IS NOT NULL AND
 NOT EXISTS (SELECT 1 FROM salas WHERE id = NEW.sala_id AND ativa = 1);
 SELECT RAISE(ABORT, 'PERIODO_BLOQUEADO') WHERE EXISTS (
 SELECT 1 FROM bloqueios WHERE data <= NEW.data AND COALESCE(data_fim, data) >= NEW.data
 AND inicio < NEW.fim AND fim > NEW.inicio);
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

CREATE TRIGGER reservas_validar_edicao BEFORE UPDATE OF sala_id, data, inicio, fim, notebooks, marca, turma ON reservas
WHEN NEW.situacao = 'confirmada'
BEGIN
 SELECT RAISE(ABORT, 'SALA_INDISPONIVEL') WHERE NEW.sala_id IS NOT NULL AND
 NOT EXISTS (SELECT 1 FROM salas WHERE id = NEW.sala_id AND ativa = 1);
 SELECT RAISE(ABORT, 'PERIODO_BLOQUEADO') WHERE EXISTS (
 SELECT 1 FROM bloqueios WHERE data <= NEW.data AND COALESCE(data_fim, data) >= NEW.data
 AND inicio < NEW.fim AND fim > NEW.inicio);
 SELECT RAISE(ABORT, 'SALA_OCUPADA') WHERE NEW.sala_id IS NOT NULL AND EXISTS (
 SELECT 1 FROM reservas WHERE id <> OLD.id AND situacao = 'confirmada' AND sala_id = NEW.sala_id
 AND data = NEW.data AND inicio < NEW.fim AND fim > NEW.inicio);
 SELECT RAISE(ABORT, 'ESTOQUE_INSUFICIENTE') WHERE NEW.notebooks > 0 AND EXISTS (
 SELECT 1 FROM (SELECT NEW.inicio AS hora UNION SELECT inicio FROM reservas
 WHERE id <> OLD.id AND data = NEW.data AND situacao = 'confirmada' AND inicio > NEW.inicio AND inicio < NEW.fim) pontos
 WHERE NEW.notebooks + COALESCE((SELECT SUM(notebooks) FROM reservas WHERE id <> OLD.id AND data = NEW.data AND situacao = 'confirmada'
 AND inicio <= pontos.hora AND fim > pontos.hora), 0) > COALESCE((SELECT SUM(funcionando) FROM equipamentos), 0));
 SELECT RAISE(ABORT, 'MARCA_INSUFICIENTE') WHERE NEW.notebooks > 0 AND NEW.marca <> '' AND EXISTS (
 SELECT 1 FROM (SELECT NEW.inicio AS hora UNION SELECT inicio FROM reservas
 WHERE id <> OLD.id AND data = NEW.data AND situacao = 'confirmada' AND inicio > NEW.inicio AND inicio < NEW.fim) pontos
 WHERE NEW.notebooks + COALESCE((SELECT SUM(notebooks) FROM reservas WHERE id <> OLD.id AND data = NEW.data AND situacao = 'confirmada'
 AND marca = NEW.marca COLLATE NOCASE AND inicio <= pontos.hora AND fim > pontos.hora), 0)
 > COALESCE((SELECT funcionando FROM equipamentos WHERE marca = NEW.marca COLLATE NOCASE), 0));
END;

CREATE TRIGGER reservas_auditar_edicao AFTER UPDATE OF sala_id, data, inicio, fim, notebooks, marca, turma ON reservas
WHEN OLD.sala_id IS NOT NEW.sala_id OR OLD.data <> NEW.data OR OLD.inicio <> NEW.inicio OR OLD.fim <> NEW.fim
 OR OLD.notebooks <> NEW.notebooks OR OLD.marca <> NEW.marca OR OLD.turma <> NEW.turma
BEGIN
 INSERT INTO reservas_alteracoes (reserva_id, conta_id, antes, depois) VALUES (
  NEW.id, NEW.conta_id,
  json_object('sala_id', OLD.sala_id, 'data', OLD.data, 'inicio', OLD.inicio, 'fim', OLD.fim,
   'notebooks', OLD.notebooks, 'marca', OLD.marca, 'turma', OLD.turma),
  json_object('sala_id', NEW.sala_id, 'data', NEW.data, 'inicio', NEW.inicio, 'fim', NEW.fim,
   'notebooks', NEW.notebooks, 'marca', NEW.marca, 'turma', NEW.turma)
 );
END;
