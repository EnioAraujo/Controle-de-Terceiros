-- ============================================================
-- Página de Administração — Profiles + RLS + is_admin()
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

-- 1. Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL DEFAULT '',
  is_admin   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Função auxiliar para verificar se o usuário atual é admin
--    SECURITY DEFINER contorna RLS ao ler a tabela internamente (sem recursão).
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

-- 3. Políticas RLS
--    Cada usuário vê apenas seu próprio perfil; admin vê todos.
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

--    Só admin pode alterar perfis (incluindo promover/revogar admin).
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Trigger: cria profile automaticamente quando um novo usuário é criado
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

-- 5. Sincronizar usuários existentes (cria profile para quem já estava cadastrado)
INSERT INTO public.profiles (id, email)
SELECT id, COALESCE(email, '')
FROM   auth.users
ON CONFLICT (id) DO NOTHING;

-- 6. Promova o primeiro admin manualmente após rodar este script:
--    UPDATE public.profiles SET is_admin = true WHERE email = 'seu@email.com';
