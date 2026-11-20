INSERT INTO salas (id, nome, ativa)
VALUES ('sala-demo-d1', 'Sala de teste D1', 1)
ON CONFLICT(id) DO NOTHING;
