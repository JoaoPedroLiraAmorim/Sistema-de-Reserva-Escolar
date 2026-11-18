CREATE TABLE contas (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    papel TEXT NOT NULL CHECK (papel IN ('professor', 'coordenacao')),
    google_sub TEXT UNIQUE,
    chave_id TEXT UNIQUE,
    chave_publica TEXT,
    contador INTEGER NOT NULL DEFAULT 0,
    ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
    CHECK (google_sub IS NOT NULL OR (chave_id IS NOT NULL AND chave_publica IS NOT NULL))
);

CREATE TABLE convites (
    hash TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    papel TEXT NOT NULL CHECK (papel IN ('professor', 'coordenacao')),
    expira INTEGER NOT NULL
);

CREATE TABLE desafios (
    id TEXT PRIMARY KEY NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('cadastro', 'login', 'google')),
    desafio TEXT NOT NULL,
    convite TEXT,
    verificador TEXT,
    expira INTEGER NOT NULL
);
CREATE INDEX desafios_expira ON desafios(expira);

CREATE TABLE sessoes (
    hash TEXT PRIMARY KEY NOT NULL,
    conta_id TEXT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    expira INTEGER NOT NULL
);
CREATE INDEX sessoes_expira ON sessoes(expira);

CREATE TABLE reservas_salas (
    id TEXT PRIMARY KEY NOT NULL,
    sala_id TEXT NOT NULL REFERENCES salas(id),
    conta_id TEXT NOT NULL REFERENCES contas(id),
    data TEXT NOT NULL,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL CHECK (inicio < fim)
);
CREATE INDEX reservas_salas_horarios ON reservas_salas(sala_id, data, inicio, fim);
CREATE INDEX reservas_salas_conta ON reservas_salas(conta_id, data, inicio);
