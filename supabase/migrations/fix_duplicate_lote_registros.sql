-- ============================================================
-- Correção: remove duplicatas intra-lote existentes e
-- adiciona constraint UNIQUE para impedir novas duplicatas
-- ============================================================

-- 1. Remove registros duplicados dentro do mesmo lote.
--    Para cada par (lote_id, lower(nome)), mantém o mais antigo (menor created_at).
DELETE FROM registros
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY lote_id, lower(nome)
        ORDER BY created_at
      ) AS rn
    FROM registros
    WHERE lote_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- 2. Adiciona índice único funcional para impedir duplicatas futuras
--    no nível do banco (case-insensitive via lower()).
CREATE UNIQUE INDEX IF NOT EXISTS registros_lote_nome_unique
  ON registros (lote_id, lower(nome))
  WHERE lote_id IS NOT NULL;
