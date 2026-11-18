-- Mantém o vínculo das reservas e das sessões com as contas existentes.
ALTER TABLE contas RENAME COLUMN google_sub TO identidade_externa;
