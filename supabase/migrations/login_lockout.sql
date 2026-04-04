-- Login lockout: bloqueia usuário após 3 tentativas falhas de login
-- Somente admin pode desbloquear via admin_unblock_user()

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked     BOOLEAN NOT NULL DEFAULT false;

-- ── record_failed_login ────────────────────────────────────────────────────
-- Chamada por anon (login falhou, sem sessão). Incrementa contador e bloqueia
-- quando atingir 3 tentativas.
CREATE OR REPLACE FUNCTION record_failed_login(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET
    login_attempts = login_attempts + 1,
    is_blocked     = CASE WHEN login_attempts + 1 >= 3 THEN true ELSE is_blocked END
  WHERE email = p_email;
END;
$$;

GRANT EXECUTE ON FUNCTION record_failed_login(TEXT) TO anon, authenticated;

-- ── check_user_blocked ──────────────────────────────────────────────────────
-- Chamada antes de tentar login para evitar round-trip desnecessário ao Supabase Auth.
CREATE OR REPLACE FUNCTION check_user_blocked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked BOOLEAN;
BEGIN
  SELECT is_blocked INTO v_blocked FROM profiles WHERE email = p_email;
  RETURN COALESCE(v_blocked, false);
END;
$$;

GRANT EXECUTE ON FUNCTION check_user_blocked(TEXT) TO anon, authenticated;

-- ── admin_unblock_user ──────────────────────────────────────────────────────
-- Somente admin (verificado server-side). Zera tentativas e desbloqueia.
CREATE OR REPLACE FUNCTION admin_unblock_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem desbloquear usuários.';
  END IF;

  UPDATE profiles
  SET login_attempts = 0,
      is_blocked     = false
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_unblock_user(UUID) TO authenticated;
