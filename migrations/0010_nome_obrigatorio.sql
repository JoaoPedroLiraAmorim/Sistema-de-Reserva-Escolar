-- Copia o nome para uma coluna NOT NULL sem reconstruir contas nem afetar suas FKs.
-- Nomes ausentes abortam o UPDATE; devem ser corrigidos antes da migracao.
ALTER TABLE contas ADD COLUMN nome_obrigatorio TEXT NOT NULL DEFAULT ''
 CHECK (length(nome_obrigatorio) <= 120);
UPDATE contas SET nome_obrigatorio = nome;
ALTER TABLE contas DROP COLUMN nome;
ALTER TABLE contas RENAME COLUMN nome_obrigatorio TO nome;
CREATE TRIGGER contas_nome_inserir BEFORE INSERT ON contas
WHEN NEW.nome IS NULL OR length(trim(NEW.nome)) NOT BETWEEN 1 AND 120
BEGIN
 SELECT RAISE(ABORT, 'NOME_OBRIGATORIO');
END;
CREATE TRIGGER contas_nome_atualizar BEFORE UPDATE OF nome ON contas
WHEN NEW.nome IS NULL OR length(trim(NEW.nome)) NOT BETWEEN 1 AND 120
BEGIN
 SELECT RAISE(ABORT, 'NOME_OBRIGATORIO');
END;
-- Revalida tambem nomes vazios ja existentes, dentro da transacao da migracao.
UPDATE contas SET nome = nome;
