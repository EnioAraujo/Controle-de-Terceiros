-- ============================================================
-- CONTROLE DE TERCEIROS — Schema Supabase (SNAPSHOT CONSOLIDADO)
-- Última atualização: 2026-03-29
-- Representa o estado FINAL do banco após todas as 19 migrations.
--
-- USO: onboarding / disaster recovery / novo ambiente.
-- NÃO aplique em banco existente sem verificar conflitos.
-- Para bancos em produção, use as migrations individuais em
-- supabase/migrations/ na ordem correta.
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================================
-- ENUMS E TIPOS COMPOSTOS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fechamento_item_input AS (
    registro_id     TEXT,
    nome            TEXT,
    data            DATE,
    turno           TEXT,
    horas           TEXT,
    valor_diaria    NUMERIC,
    valor_hora      NUMERIC,
    valor_calculado NUMERIC,
    ajuste_manual   BOOLEAN,
    obs             TEXT
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1. TABELA registros
-- ============================================================

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

  CONSTRAINT registros_pkey             PRIMARY KEY (id),
  CONSTRAINT registros_nome_check       CHECK (char_length(trim(nome)) > 0),
  CONSTRAINT registros_turno_check      CHECK (char_length(trim(turno)) > 0),
  CONSTRAINT registros_unidade_check    CHECK (char_length(trim(unidade)) > 0),
  CONSTRAINT registros_fornecedor_check CHECK (char_length(trim(fornecedor)) > 0)
);

ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;

-- RLS: registros
DROP POLICY IF EXISTS "authed_select_registros" ON public.registros;
DROP POLICY IF EXISTS "aal2_insert_registros"   ON public.registros;
DROP POLICY IF EXISTS "aal2_update_registros"   ON public.registros;
DROP POLICY IF EXISTS "aal2_delete_registros"   ON public.registros;
-- Políticas legacy (removidas na migração para AAL2)
DROP POLICY IF EXISTS "anon_select_registros"    ON public.registros;
DROP POLICY IF EXISTS "authed_insert_registros"  ON public.registros;
DROP POLICY IF EXISTS "authed_update_registros"  ON public.registros;
DROP POLICY IF EXISTS "authed_delete_registros"  ON public.registros;
-- SELECT: autenticados
CREATE POLICY "authed_select_registros"   ON public.registros FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
-- INSERT/UPDATE/DELETE: autenticados AAL2
CREATE POLICY "aal2_insert_registros"     ON public.registros FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_update_registros"     ON public.registros FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL AND public.is_aal2()) WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_delete_registros"     ON public.registros FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL AND public.is_aal2());

-- ============================================================
-- 2. TABELA opcoes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.opcoes (
  id        BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chave     TEXT        NOT NULL,
  valor     TEXT        NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT opcoes_chave_valor_key UNIQUE (chave, valor),
  CONSTRAINT opcoes_chave_check CHECK (char_length(trim(chave)) > 0),
  CONSTRAINT opcoes_valor_check CHECK (char_length(trim(valor)) > 0)
);

ALTER TABLE public.opcoes ENABLE ROW LEVEL SECURITY;

-- RLS: opcoes
DROP POLICY IF EXISTS "authed_select_opcoes" ON public.opcoes;
DROP POLICY IF EXISTS "aal2_insert_opcoes"   ON public.opcoes;
DROP POLICY IF EXISTS "aal2_update_opcoes"   ON public.opcoes;
DROP POLICY IF EXISTS "aal2_delete_opcoes"   ON public.opcoes;
DROP POLICY IF EXISTS "anon_select_opcoes"   ON public.opcoes;
DROP POLICY IF EXISTS "authed_insert_opcoes" ON public.opcoes;
DROP POLICY IF EXISTS "authed_update_opcoes" ON public.opcoes;
DROP POLICY IF EXISTS "authed_delete_opcoes" ON public.opcoes;
CREATE POLICY "authed_select_opcoes" ON public.opcoes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "aal2_insert_opcoes"   ON public.opcoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_update_opcoes"   ON public.opcoes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL AND public.is_aal2()) WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());
CREATE POLICY "aal2_delete_opcoes"   ON public.opcoes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL AND public.is_aal2());

-- ============================================================
-- 3. TABELA profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT        NOT NULL DEFAULT '',
  is_admin            BOOLEAN     NOT NULL DEFAULT false,
  is_approved         BOOLEAN     NOT NULL DEFAULT false,
  custom_permissions  TEXT[]               DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS: profiles
DROP POLICY IF EXISTS "profiles_select"       ON public.profiles;
DROP POLICY IF EXISTS "aal2_profiles_update"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_select"         ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "aal2_profiles_update"    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id AND public.is_aal2()) WITH CHECK (auth.uid() = id AND public.is_aal2());
CREATE POLICY "profiles_update_admin"   ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 4. TABELA user_roles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS: user_roles
DROP POLICY IF EXISTS "user_roles_select"    ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all_admin" ON public.user_roles;
CREATE POLICY "user_roles_select"    ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_roles_all_admin" ON public.user_roles FOR ALL  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 5. TABELA audit_log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operacao    TEXT        NOT NULL,
  tabela      TEXT        NOT NULL DEFAULT 'registros',
  registro_id TEXT,
  uid         TEXT,
  dados       JSONB,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_log_operacao_check CHECK (operacao IN (
    'INSERT', 'UPDATE', 'DELETE', 'PURGE', 'EXCLUSAO_TITULAR',
    'DELETE_ERROR', 'UPSERT_ERROR', 'PURGE_ERROR', 'INSERT_ERROR', 'UPDATE_ERROR'
  ))
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: audit_log — apenas escrita AAL2; sem SELECT (imutável, restrito ao backend)
DROP POLICY IF EXISTS "aal2_insert_audit_log"    ON public.audit_log;
DROP POLICY IF EXISTS "authed_select_audit_log"  ON public.audit_log;
CREATE POLICY "aal2_insert_audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());

-- ============================================================
-- 6. TABELA terceiros
-- ============================================================

CREATE TABLE IF NOT EXISTS public.terceiros (
  id        BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome      TEXT        NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT terceiros_nome_key   UNIQUE (nome),
  CONSTRAINT terceiros_nome_check CHECK (char_length(trim(nome)) > 0)
);

ALTER TABLE public.terceiros ENABLE ROW LEVEL SECURITY;

-- RLS: terceiros
DROP POLICY IF EXISTS "authed_select_terceiros"     ON public.terceiros;
DROP POLICY IF EXISTS "aal2_admin_insert_terceiros" ON public.terceiros;
DROP POLICY IF EXISTS "aal2_admin_update_terceiros" ON public.terceiros;
DROP POLICY IF EXISTS "aal2_admin_delete_terceiros" ON public.terceiros;
CREATE POLICY "authed_select_terceiros"      ON public.terceiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "aal2_admin_insert_terceiros"  ON public.terceiros FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_update_terceiros"  ON public.terceiros FOR UPDATE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)) WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_delete_terceiros"  ON public.terceiros FOR DELETE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));

-- ============================================================
-- 7. TABELA turnos_config
-- ============================================================

CREATE TABLE IF NOT EXISTS public.turnos_config (
  turno        TEXT PRIMARY KEY,
  hora_inicio  TEXT NOT NULL DEFAULT '00:00',
  hora_fim     TEXT NOT NULL DEFAULT '00:00',
  hora_padrao  TEXT NOT NULL DEFAULT '08:20',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.turnos_config ENABLE ROW LEVEL SECURITY;

-- RLS: turnos_config
DROP POLICY IF EXISTS "authed_select_turnos_config"    ON public.turnos_config;
DROP POLICY IF EXISTS "aal2_admin_insert_turnos_config" ON public.turnos_config;
DROP POLICY IF EXISTS "aal2_admin_update_turnos_config" ON public.turnos_config;
DROP POLICY IF EXISTS "aal2_admin_delete_turnos_config" ON public.turnos_config;
CREATE POLICY "authed_select_turnos_config"     ON public.turnos_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "aal2_admin_insert_turnos_config"  ON public.turnos_config FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_update_turnos_config"  ON public.turnos_config FOR UPDATE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)) WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_delete_turnos_config"  ON public.turnos_config FOR DELETE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));

-- Dados padrão de turnos
INSERT INTO public.turnos_config (turno, hora_inicio, hora_fim, hora_padrao) VALUES
  ('1ª TURNO',      '05:21', '13:40', '08:20'),
  ('2ª TURNO',      '13:41', '22:00', '08:20'),
  ('3ª TURNO',      '22:01', '05:20', '07:20'),
  ('INTERMEDIÁRIO', '07:00', '16:48', '09:48')
ON CONFLICT (turno) DO NOTHING;

-- ============================================================
-- 8. TABELA diarias_config
-- ============================================================

CREATE TABLE IF NOT EXISTS public.diarias_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor   TEXT NOT NULL,
  turno        TEXT,
  valor_diaria NUMERIC(10,2) NOT NULL DEFAULT 250.00,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fornecedor, turno)
);

ALTER TABLE public.diarias_config ENABLE ROW LEVEL SECURITY;

-- RLS: diarias_config
DROP POLICY IF EXISTS "authed_select_diarias_config"    ON public.diarias_config;
DROP POLICY IF EXISTS "aal2_admin_insert_diarias_config" ON public.diarias_config;
DROP POLICY IF EXISTS "aal2_admin_update_diarias_config" ON public.diarias_config;
DROP POLICY IF EXISTS "aal2_admin_delete_diarias_config" ON public.diarias_config;
CREATE POLICY "authed_select_diarias_config"     ON public.diarias_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "aal2_admin_insert_diarias_config"  ON public.diarias_config FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_update_diarias_config"  ON public.diarias_config FOR UPDATE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)) WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_delete_diarias_config"  ON public.diarias_config FOR DELETE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));

-- ============================================================
-- 9. TABELA fechamentos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fechamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor   TEXT NOT NULL,
  data_inicio  DATE NOT NULL,
  data_fim     DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','revisao','aprovado')),
  valor_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;

-- RLS: fechamentos
DROP POLICY IF EXISTS "Usuarios_autenticados_podem_ver_fechamentos" ON public.fechamentos;
DROP POLICY IF EXISTS "aal2_admin_insert_fechamentos"               ON public.fechamentos;
DROP POLICY IF EXISTS "aal2_admin_update_fechamentos"               ON public.fechamentos;
DROP POLICY IF EXISTS "aal2_admin_delete_fechamentos"               ON public.fechamentos;
CREATE POLICY "Usuarios_autenticados_podem_ver_fechamentos" ON public.fechamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "aal2_admin_insert_fechamentos"               ON public.fechamentos FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_update_fechamentos"               ON public.fechamentos FOR UPDATE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)) WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_delete_fechamentos"               ON public.fechamentos FOR DELETE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));

-- ============================================================
-- 10. TABELA fechamento_itens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fechamento_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id   UUID NOT NULL REFERENCES public.fechamentos(id) ON DELETE CASCADE,
  registro_id     TEXT,
  nome            TEXT NOT NULL,
  data            DATE NOT NULL,
  turno           TEXT NOT NULL,
  horas           TEXT NOT NULL DEFAULT '00:00',
  valor_diaria    NUMERIC(10,2) NOT NULL,
  valor_hora      NUMERIC(10,4) NOT NULL,
  valor_calculado NUMERIC(10,2) NOT NULL,
  ajuste_manual   BOOLEAN NOT NULL DEFAULT false,
  obs             TEXT DEFAULT ''
);

ALTER TABLE public.fechamento_itens ENABLE ROW LEVEL SECURITY;

-- RLS: fechamento_itens
DROP POLICY IF EXISTS "Usuarios_autenticados_podem_ver_itens"  ON public.fechamento_itens;
DROP POLICY IF EXISTS "aal2_admin_insert_fechamento_itens"      ON public.fechamento_itens;
DROP POLICY IF EXISTS "aal2_admin_update_fechamento_itens"      ON public.fechamento_itens;
DROP POLICY IF EXISTS "aal2_admin_delete_fechamento_itens"      ON public.fechamento_itens;
CREATE POLICY "Usuarios_autenticados_podem_ver_itens"   ON public.fechamento_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "aal2_admin_insert_fechamento_itens"       ON public.fechamento_itens FOR INSERT TO authenticated WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_update_fechamento_itens"       ON public.fechamento_itens FOR UPDATE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)) WITH CHECK (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
CREATE POLICY "aal2_admin_delete_fechamento_itens"       ON public.fechamento_itens FOR DELETE TO authenticated USING (public.is_aal2() AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================

-- registros
CREATE INDEX IF NOT EXISTS idx_registros_data_turno   ON public.registros (data, turno);
CREATE INDEX IF NOT EXISTS idx_registros_fornecedor   ON public.registros (fornecedor);
CREATE INDEX IF NOT EXISTS idx_registros_unidade      ON public.registros (unidade);
CREATE INDEX IF NOT EXISTS idx_registros_lote_id      ON public.registros (lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registros_nome_trgm    ON public.registros USING GIN (nome gin_trgm_ops);

-- opcoes
CREATE INDEX IF NOT EXISTS idx_opcoes_chave           ON public.opcoes (chave);

-- terceiros
CREATE INDEX IF NOT EXISTS idx_terceiros_nome         ON public.terceiros (nome);
CREATE INDEX IF NOT EXISTS idx_terceiros_nome_trgm    ON public.terceiros USING GIN (to_tsvector('portuguese', nome));

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela_operacao ON public.audit_log (tabela, operacao);
CREATE INDEX IF NOT EXISTS idx_audit_log_criado_em       ON public.audit_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro_id     ON public.audit_log (registro_id) WHERE registro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_uid             ON public.audit_log (uid) WHERE uid IS NOT NULL;

-- fechamentos
CREATE INDEX IF NOT EXISTS idx_fechamento_itens_fk   ON public.fechamento_itens (fechamento_id);
CREATE INDEX IF NOT EXISTS idx_fechamentos_fornecedor ON public.fechamentos (fornecedor);
CREATE INDEX IF NOT EXISTS idx_fechamentos_periodo    ON public.fechamentos (data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_diarias_config_forn   ON public.diarias_config (fornecedor);

-- ============================================================
-- FUNÇÕES
-- ============================================================

-- Verifica se a sessão está em AAL2 (TOTP verificado)
CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'amr' @> '[{"method": "totp"}]'::jsonb)
    OR (auth.jwt() ->> 'aal') = 'aal2',
    false
  );
$$;

-- Verifica se o usuário atual é admin (SECURITY DEFINER contorna RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE COALESCE(
      (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
      false
    )
  END;
$$;

-- Cria profile automaticamente quando novo usuário é criado no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Sincroniza profiles.is_admin quando user_roles.role muda
CREATE OR REPLACE FUNCTION public.sync_is_admin_from_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles
  SET    is_admin = (NEW.role = 'admin')
  WHERE  id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Sincroniza email em profiles quando auth.users.email é atualizado
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles
  SET email = COALESCE(NEW.email, '')
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Purga registros com mais de 5 anos (LGPD Art. 15/16)
CREATE OR REPLACE FUNCTION public.purge_old_registros()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  limite DATE := CURRENT_DATE - INTERVAL '5 years';
  qtd    INT;
BEGIN
  SELECT COUNT(*) INTO qtd FROM public.registros WHERE data < limite;
  IF qtd > 0 THEN
    INSERT INTO public.audit_log (operacao, tabela, dados)
    VALUES ('PURGE', 'registros', jsonb_build_object(
      'motivo', 'Retenção LGPD — Art. 15 e 16',
      'limite_data', limite,
      'registros_removidos', qtd
    ));
    DELETE FROM public.registros WHERE data < limite;
  END IF;
END;
$$;

-- Cria fechamento financeiro em transação atômica
CREATE OR REPLACE FUNCTION public.criar_fechamento(
  p_fornecedor    TEXT,
  p_data_inicio   DATE,
  p_data_fim      DATE,
  p_status        TEXT,
  p_valor_total   NUMERIC,
  p_created_by    UUID,
  p_itens         public.fechamento_item_input[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_fechamento_id UUID;
  v_item          public.fechamento_item_input;
BEGIN
  INSERT INTO public.fechamentos (fornecedor, data_inicio, data_fim, status, valor_total, created_by, created_at, updated_at)
  VALUES (p_fornecedor, p_data_inicio, p_data_fim, p_status, p_valor_total, p_created_by, NOW(), NOW())
  RETURNING id INTO v_fechamento_id;

  FOREACH v_item IN ARRAY p_itens LOOP
    INSERT INTO public.fechamento_itens (fechamento_id, registro_id, nome, data, turno, horas, valor_diaria, valor_hora, valor_calculado, ajuste_manual, obs)
    VALUES (v_fechamento_id, v_item.registro_id, v_item.nome, v_item.data, v_item.turno, v_item.horas, v_item.valor_diaria, v_item.valor_hora, v_item.valor_calculado, v_item.ajuste_manual, v_item.obs);
  END LOOP;

  RETURN v_fechamento_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar fechamento: %', SQLERRM;
END;
$$;

-- Exclui fechamento e seus itens em transação atômica
CREATE OR REPLACE FUNCTION public.excluir_fechamento(
  p_fechamento_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  DELETE FROM public.fechamento_itens WHERE fechamento_id = p_fechamento_id;
  DELETE FROM public.fechamentos        WHERE id           = p_fechamento_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao excluir fechamento: %', SQLERRM;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_updated();

DROP TRIGGER IF EXISTS on_user_role_changed ON public.user_roles;
CREATE TRIGGER on_user_role_changed
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_is_admin_from_role();

-- ============================================================
-- AGENDAMENTO LGPD (pg_cron — habilitar em Dashboard → Extensions)
-- ============================================================
-- SELECT cron.schedule('lgpd-purge-old-registros', '0 2 * * *', 'SELECT public.purge_old_registros();');

-- ============================================================
-- PÓS-DEPLOY: Promover o primeiro admin
-- ============================================================
-- UPDATE public.profiles SET is_admin = true WHERE email = 'seu@email.com';
-- INSERT INTO public.user_roles (user_id, role) VALUES ('<uuid>', 'admin') ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

