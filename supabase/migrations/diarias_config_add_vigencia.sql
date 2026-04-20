-- Adiciona colunas de vigência à tabela diarias_config
-- Permite múltiplos valores de diária para o mesmo par (fornecedor, turno) em períodos distintos.
-- Registros existentes ficam com vigencia_inicio e vigencia_fim NULL = "sempre válido".

-- 1. Adicionar colunas
ALTER TABLE public.diarias_config
  ADD COLUMN IF NOT EXISTS vigencia_inicio DATE,
  ADD COLUMN IF NOT EXISTS vigencia_fim    DATE;

-- 2. Remover restrição UNIQUE que impedia múltiplos períodos para o mesmo par
ALTER TABLE public.diarias_config
  DROP CONSTRAINT IF EXISTS diarias_config_fornecedor_turno_key;

-- 3. Restrição: vigencia_fim >= vigencia_inicio (quando ambos preenchidos)
ALTER TABLE public.diarias_config
  ADD CONSTRAINT diarias_config_vigencia_check
    CHECK (vigencia_fim IS NULL OR vigencia_inicio IS NULL OR vigencia_fim >= vigencia_inicio);
