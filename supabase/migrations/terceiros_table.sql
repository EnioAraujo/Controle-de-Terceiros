-- ============================================================
-- Tabela dedicada para nomes de terceiros (colaboradores)
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.terceiros (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT terceiros_nome_key   UNIQUE (nome),
  CONSTRAINT terceiros_nome_check CHECK (char_length(trim(nome)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_terceiros_nome ON public.terceiros (nome);

ALTER TABLE public.terceiros ENABLE ROW LEVEL SECURITY;

-- Leitura para autenticados
CREATE POLICY "authed_select_terceiros"
  ON public.terceiros FOR SELECT TO authenticated
  USING (true);

-- Escrita para autenticados
CREATE POLICY "authed_insert_terceiros"
  ON public.terceiros FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "authed_delete_terceiros"
  ON public.terceiros FOR DELETE TO authenticated
  USING (true);

-- Migrar nomes existentes da tabela opcoes (se houver)
INSERT INTO public.terceiros (nome)
SELECT DISTINCT valor
FROM   public.opcoes
WHERE  chave = 'nomes'
  AND  char_length(trim(valor)) > 0
ON CONFLICT (nome) DO NOTHING;
