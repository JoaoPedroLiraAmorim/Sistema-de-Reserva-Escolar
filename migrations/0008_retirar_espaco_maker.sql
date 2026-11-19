-- Retira a sala da operação sem excluir reservas históricas vinculadas.
UPDATE salas SET ativa = 0
WHERE lower(replace(trim(nome), 'Ç', 'ç')) IN ('espaço maker', 'espaco maker');

CREATE TRIGGER salas_impedir_maker_insert BEFORE INSERT ON salas
WHEN lower(replace(trim(NEW.nome), 'Ç', 'ç')) IN ('espaço maker', 'espaco maker')
BEGIN
 SELECT RAISE(ABORT, 'SALA_REMOVIDA');
END;
CREATE TRIGGER salas_impedir_maker_update BEFORE UPDATE OF nome, ativa ON salas
WHEN NEW.ativa = 1 AND lower(replace(trim(NEW.nome), 'Ç', 'ç')) IN ('espaço maker', 'espaco maker')
BEGIN
 SELECT RAISE(ABORT, 'SALA_REMOVIDA');
END;
