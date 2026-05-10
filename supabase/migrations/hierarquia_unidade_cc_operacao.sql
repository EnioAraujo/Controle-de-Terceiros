-- ============================================================
-- Hierarquia UNIDADE → CC → OPERAÇÃO + Pessoa (terceiros estendido)
-- ============================================================
-- Cria estrutura hierárquica para os catálogos de Unidade, Centro de
-- Custo e Operação (anteriormente "motivo"), e estende a tabela
-- terceiros com cargo padrão e fornecedor padrão por pessoa.
--
-- Os campos TEXT correspondentes em public.registros (unidade, cc,
-- motivo) permanecem inalterados — armazenam o rótulo selecionado no
-- momento do lançamento (histórico imutável).
-- ============================================================

-- ── 1. Tabela unidades ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unidades (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unidades_nome_key   UNIQUE (nome),
  CONSTRAINT unidades_nome_check CHECK (char_length(trim(nome)) > 0)
);

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authed_select_unidades" ON public.unidades;
DROP POLICY IF EXISTS "aal2_insert_unidades"   ON public.unidades;
DROP POLICY IF EXISTS "aal2_update_unidades"   ON public.unidades;
DROP POLICY IF EXISTS "aal2_delete_unidades"   ON public.unidades;

CREATE POLICY "authed_select_unidades" ON public.unidades FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "aal2_insert_unidades"   ON public.unidades FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_update_unidades"   ON public.unidades FOR UPDATE TO authenticated
  USING      (auth.uid() IS NOT NULL AND public.is_aal2())
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_delete_unidades"   ON public.unidades FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_aal2());

-- ── 2. Tabela ccs (centros de custo, filhos de unidade) ──────
CREATE TABLE IF NOT EXISTS public.ccs (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unidade_id  BIGINT      NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  codigo      TEXT        NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ccs_unidade_codigo_key UNIQUE (unidade_id, codigo),
  CONSTRAINT ccs_codigo_check       CHECK (char_length(trim(codigo)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ccs_unidade_id ON public.ccs (unidade_id);

ALTER TABLE public.ccs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authed_select_ccs" ON public.ccs;
DROP POLICY IF EXISTS "aal2_insert_ccs"   ON public.ccs;
DROP POLICY IF EXISTS "aal2_update_ccs"   ON public.ccs;
DROP POLICY IF EXISTS "aal2_delete_ccs"   ON public.ccs;

CREATE POLICY "authed_select_ccs" ON public.ccs FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "aal2_insert_ccs"   ON public.ccs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_update_ccs"   ON public.ccs FOR UPDATE TO authenticated
  USING      (auth.uid() IS NOT NULL AND public.is_aal2())
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_delete_ccs"   ON public.ccs FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_aal2());

-- ── 3. Tabela operacoes (filhas de CC) ───────────────────────
CREATE TABLE IF NOT EXISTS public.operacoes (
  id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cc_id      BIGINT      NOT NULL REFERENCES public.ccs(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT operacoes_cc_nome_key UNIQUE (cc_id, nome),
  CONSTRAINT operacoes_nome_check  CHECK (char_length(trim(nome)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_operacoes_cc_id ON public.operacoes (cc_id);

ALTER TABLE public.operacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authed_select_operacoes" ON public.operacoes;
DROP POLICY IF EXISTS "aal2_insert_operacoes"   ON public.operacoes;
DROP POLICY IF EXISTS "aal2_update_operacoes"   ON public.operacoes;
DROP POLICY IF EXISTS "aal2_delete_operacoes"   ON public.operacoes;

CREATE POLICY "authed_select_operacoes" ON public.operacoes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "aal2_insert_operacoes"   ON public.operacoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_update_operacoes"   ON public.operacoes FOR UPDATE TO authenticated
  USING      (auth.uid() IS NOT NULL AND public.is_aal2())
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_delete_operacoes"   ON public.operacoes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_aal2());

-- ── 4. Extensão de terceiros (Pessoa = nome + cargo + fornecedor) ─
ALTER TABLE public.terceiros
  ADD COLUMN IF NOT EXISTS cargo      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fornecedor TEXT NOT NULL DEFAULT '';

-- ── 5. SEED: Hierarquia 2026 extraída de arquivolocal/TERCEIROS.xlsx ─
-- Escopo: apenas registros com DATA_PRESENCA em 2026.
-- Combinação única observada: UDI → BAT → OPERAÇÃO BAT HUB BRASIL.
-- Demais CCs/operações (CROMUS, ENTREPOSTO, etc.) cadastrados via UI quando necessário.
DO $$
DECLARE
  v_uid BIGINT;
  v_cid BIGINT;
BEGIN
  INSERT INTO public.unidades (nome) VALUES ('UDI') ON CONFLICT (nome) DO NOTHING;
  SELECT id INTO v_uid FROM public.unidades WHERE nome = 'UDI';

  INSERT INTO public.ccs (unidade_id, codigo) VALUES (v_uid, 'BAT') ON CONFLICT (unidade_id, codigo) DO NOTHING;
  SELECT id INTO v_cid FROM public.ccs WHERE unidade_id = v_uid AND codigo = 'BAT';
  INSERT INTO public.operacoes (cc_id, nome) VALUES (v_cid, 'OPERAÇÃO BAT HUB BRASIL') ON CONFLICT (cc_id, nome) DO NOTHING;
END $$;

-- ── 6. SEED: Catálogos globais usados em 2026 (idempotente) ──
-- Garante que cargos/fornecedores canonizados existam em public.opcoes
-- para que os dropdowns do FormLancamento e ConfigPessoasSection
-- exibam os valores normalizados sem marca "(legado)".
INSERT INTO public.opcoes (chave, valor) VALUES
  ('cargos',       'AUXILIAR DE DEPÓSITO'),
  ('cargos',       'OPERADOR DE EMPILHADEIRA'),
  ('fornecedores', 'LIDER MASTER'),
  ('fornecedores', 'JSS')
ON CONFLICT (chave, valor) DO NOTHING;
