-- Estrutura do banco: não inclui dados de demonstração.
CREATE TABLE salas (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
    nome TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(nome)) BETWEEN 1 AND 100),
    ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1))
);
