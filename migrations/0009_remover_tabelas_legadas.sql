-- Bloqueia a limpeza se houver dados antigos que ainda precisem de revisao.
CREATE TABLE verificar_legado (
 pendencias INTEGER NOT NULL,
 CONSTRAINT legado_precisa_de_revisao CHECK (pendencias = 0)
);
INSERT INTO verificar_legado (pendencias)
SELECT (SELECT COUNT(*) FROM convites) + (SELECT COUNT(*) FROM desafios) +
 (SELECT COUNT(*) FROM reservas_salas antiga WHERE NOT EXISTS (
  SELECT 1 FROM reservas atual WHERE atual.id = antiga.id
   AND atual.conta_id = antiga.conta_id AND atual.sala_id = antiga.sala_id
   AND atual.data = antiga.data AND atual.inicio = antiga.inicio AND atual.fim = antiga.fim
 ));
DROP TABLE verificar_legado;
DROP TABLE convites;
DROP TABLE desafios;
DROP TABLE reservas_salas;
