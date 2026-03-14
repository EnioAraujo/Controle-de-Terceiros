-- ============================================================
-- CONTROLE DE TERCEIROS — Schema Supabase
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

-- 1. Tabela de registros de presença de terceirizados
CREATE TABLE IF NOT EXISTS public.registros (
  id           TEXT         NOT NULL,
  lote_id      TEXT,
  data         DATE         NOT NULL,
  turno        TEXT         NOT NULL,
  hora_entrada TEXT         NOT NULL,
  hora_saida   TEXT         NOT NULL,
  total_horas  TEXT         NOT NULL,
  nome         TEXT         NOT NULL,
  cargo        TEXT         NOT NULL,
  setor        TEXT         NOT NULL DEFAULT '',
  unidade      TEXT         NOT NULL,
  cc           TEXT         NOT NULL,
  motivo       TEXT         NOT NULL,
  fornecedor   TEXT         NOT NULL,
  obs          TEXT         NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT registros_pkey PRIMARY KEY (id),
  -- Garantir que nome e outros campos textuais não sejam vazios
  CONSTRAINT registros_nome_check      CHECK (char_length(trim(nome)) > 0),
  CONSTRAINT registros_turno_check     CHECK (char_length(trim(turno)) > 0),
  CONSTRAINT registros_unidade_check   CHECK (char_length(trim(unidade)) > 0),
  CONSTRAINT registros_fornecedor_check CHECK (char_length(trim(fornecedor)) > 0)
);

-- 2. Tabela de opções dos campos de seleção
CREATE TABLE IF NOT EXISTS public.opcoes (
  id        BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chave     TEXT        NOT NULL,
  valor     TEXT        NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT opcoes_chave_valor_key UNIQUE (chave, valor),
  CONSTRAINT opcoes_chave_check CHECK (char_length(trim(chave)) > 0),
  CONSTRAINT opcoes_valor_check CHECK (char_length(trim(valor)) > 0)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_registros_data       ON public.registros (data);
CREATE INDEX IF NOT EXISTS idx_registros_fornecedor ON public.registros (fornecedor);
CREATE INDEX IF NOT EXISTS idx_registros_lote_id    ON public.registros (lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opcoes_chave         ON public.opcoes (chave);

-- ============================================================
-- Row Level Security (RLS)
-- IMPORTANTE: habilitar RLS em todas as tabelas
-- ============================================================
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opcoes    ENABLE ROW LEVEL SECURITY;

-- Leitura pública — SELECT para role anon (sem autenticação).
-- O linter Supabase exclui intencionalmente SELECT com USING(true).
CREATE POLICY "anon_select_registros"
  ON public.registros FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_select_opcoes"
  ON public.opcoes FOR SELECT TO anon
  USING (true);

-- Escrita restrita — INSERT / UPDATE / DELETE exigem sessão autenticada.
-- Cobre e-mail/senha E sessões anônimas (supabase.auth.signInAnonymously).
-- auth.uid() IS NOT NULL é verdadeiro para qualquer token authenticated válido.
CREATE POLICY "authed_insert_registros"
  ON public.registros FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authed_update_registros"
  ON public.registros FOR UPDATE TO authenticated
  USING     (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authed_delete_registros"
  ON public.registros FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authed_insert_opcoes"
  ON public.opcoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authed_update_opcoes"
  ON public.opcoes FOR UPDATE TO authenticated
  USING     (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authed_delete_opcoes"
  ON public.opcoes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- NOTA PARA O DBA:
-- Políticas de escrita já usam auth.uid() IS NOT NULL.
-- O app usa supabase.auth.signInAnonymously() para garantir
-- que toda sessão tenha um UUID gerado pelo Supabase Auth.
--
-- Quando usuários nominais forem adicionados, substituir por:
--
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id)
--
-- E adicionar a coluna: user_id UUID REFERENCES auth.users(id)
-- ============================================================
