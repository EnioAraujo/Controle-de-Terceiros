-- ============================================================
-- SETUP COMPLETO: Profiles + RBAC + Promover Admin
-- Execute este script INTEIRO no SQL Editor do Supabase
-- (Dashboard → SQL Editor → New Query → Cole e clique Run)
-- ============================================================

-- ── PARTE 1: admin_setup.sql ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL DEFAULT '',
  is_admin   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garante coluna is_admin caso a tabela já existisse sem ela
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email      TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

DO $$ BEGIN
  CREATE POLICY "profiles_select"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles_update"
    ON public.profiles FOR UPDATE TO authenticated
    USING     (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Garante que todos os usuários já existentes têm profile
INSERT INTO public.profiles (id, email)
SELECT id, COALESCE(email, '')
FROM   auth.users
ON CONFLICT (id) DO NOTHING;

-- ── PARTE 2: rbac_approvals.sql ──────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "user_roles_select"
    ON public.user_roles FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_roles_all_admin"
    ON public.user_roles FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved        BOOLEAN  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_permissions TEXT[]            DEFAULT '{}';

INSERT INTO public.user_roles (user_id, role)
SELECT id, CASE WHEN is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
FROM   public.profiles
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_is_admin_from_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles SET is_admin = (NEW.role = 'admin') WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_is_admin ON public.user_roles;
CREATE TRIGGER trg_sync_is_admin
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_is_admin_from_role();

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── PARTE 3: PROMOVER SEU USUÁRIO A ADMIN ────────────────────
-- Substitua 'seu@email.com' pelo e-mail da sua conta

UPDATE public.profiles
SET    is_admin = true
WHERE  email = 'enio.sales@supplog.com';

UPDATE public.user_roles
SET    role = 'admin'
WHERE  user_id = (SELECT id FROM public.profiles WHERE email = 'enio.sales@supplog.com');

-- ── VERIFICAÇÃO ──────────────────────────────────────────────
-- Deve retornar sua linha com is_admin = true
SELECT p.email, p.is_admin, ur.role
FROM   public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
ORDER BY p.created_at;
