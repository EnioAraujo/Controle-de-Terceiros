// Traduções e utilitários puros (sem JSX/React)

export type Lang = "pt-BR" | "en-US";

export const translations = {
  "pt-BR": {
    // Login
    login_title:        "Entrar",
    login_subtitle:     "Acesse o sistema de controle de terceirizados",
    login_email:        "E-mail",
    login_password:     "Senha",
    login_placeholder_email: "seu@email.com",
    login_placeholder_pass:  "Sua senha",
    login_btn:          "Entrar",
    login_btn_loading:  "Entrando…",
    login_no_account:   "Para criar uma nova conta, entre em contato com o administrador.",
    login_err_invalid:  "E-mail ou senha incorretos.",
    login_err_unconfirmed: "E-mail ainda não confirmado. Verifique sua caixa de entrada.",
    login_err_too_many: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    login_err_generic:  "Ocorreu um erro. Tente novamente.",

    // Reset password
    reset_title:        "Redefinir senha",
    reset_subtitle:     "Digite sua nova senha abaixo",
    reset_label_new:    "Nova senha",
    reset_label_confirm:"Confirmar nova senha",
    reset_placeholder_new:     "Mínimo 6 caracteres",
    reset_placeholder_confirm: "Repita a senha",
    reset_btn:          "Salvar nova senha",
    reset_btn_loading:  "Salvando…",
    reset_success:      "Senha redefinida com sucesso! Redirecionando…",
    reset_err_mismatch: "As senhas não coincidem.",
    reset_err_short:    "A senha deve ter no mínimo 6 caracteres.",
    reset_err_same:     "A nova senha deve ser diferente da atual.",
    reset_err_generic:  "Ocorreu um erro. Tente novamente.",
    reset_checking:     "Verificando…",
    reset_invalid_link: "Link inválido ou expirado.",
    reset_redirecting:  "Redirecionando para o login…",

    // Admin
    admin_loading:      "Carregando…",
    admin_access_denied:"Acesso Negado",
    admin_access_denied_desc: "Você não tem permissão de administrador para acessar esta página.",
    admin_back_home:    "Voltar ao início",
    admin_panel_title:  "Painel de Administração",
    admin_panel_desc:   "Gerencie usuários, permissões e configurações de conta.",
    admin_tab_users:    "Usuários",
    admin_tab_account:  "Minha Conta",
    admin_back_app:     "Voltar ao app",
    admin_logout:       "Sair",
    admin_email_sent:   "E-mail de redefinição enviado!",
    admin_err_reset:    "Erro ao enviar e-mail:",
    admin_pass_mismatch:"As senhas não coincidem.",
    admin_pass_short:   "Mínimo de 6 caracteres.",
    admin_pass_success: "Senha alterada com sucesso!",
    admin_pass_same:    "A nova senha deve ser diferente da atual.",
    admin_pass_err:     "Erro ao alterar senha:",

    // App
    app_loading:        "Carregando…",
  },

  "en-US": {
    // Login
    login_title:        "Sign in",
    login_subtitle:     "Access the third-party workforce control system",
    login_email:        "E-mail",
    login_password:     "Password",
    login_placeholder_email: "your@email.com",
    login_placeholder_pass:  "Your password",
    login_btn:          "Sign in",
    login_btn_loading:  "Signing in…",
    login_no_account:   "To create a new account, contact the administrator.",
    login_err_invalid:  "Incorrect e-mail or password.",
    login_err_unconfirmed: "E-mail not yet confirmed. Please check your inbox.",
    login_err_too_many: "Too many attempts. Please wait a few minutes and try again.",
    login_err_generic:  "An error occurred. Please try again.",

    // Reset password
    reset_title:        "Reset password",
    reset_subtitle:     "Enter your new password below",
    reset_label_new:    "New password",
    reset_label_confirm:"Confirm new password",
    reset_placeholder_new:     "At least 6 characters",
    reset_placeholder_confirm: "Repeat password",
    reset_btn:          "Save new password",
    reset_btn_loading:  "Saving…",
    reset_success:      "Password reset successfully! Redirecting…",
    reset_err_mismatch: "Passwords do not match.",
    reset_err_short:    "Password must be at least 6 characters.",
    reset_err_same:     "New password must be different from the current one.",
    reset_err_generic:  "An error occurred. Please try again.",
    reset_checking:     "Verifying…",
    reset_invalid_link: "Invalid or expired link.",
    reset_redirecting:  "Redirecting to login…",

    // Admin
    admin_loading:      "Loading…",
    admin_access_denied:"Access Denied",
    admin_access_denied_desc: "You do not have administrator permission to access this page.",
    admin_back_home:    "Back to home",
    admin_panel_title:  "Administration Panel",
    admin_panel_desc:   "Manage users, permissions, and account settings.",
    admin_tab_users:    "Users",
    admin_tab_account:  "My Account",
    admin_back_app:     "Back to app",
    admin_logout:       "Sign out",
    admin_email_sent:   "Password reset e-mail sent!",
    admin_err_reset:    "Error sending e-mail:",
    admin_pass_mismatch:"Passwords do not match.",
    admin_pass_short:   "Minimum 6 characters.",
    admin_pass_success: "Password changed successfully!",
    admin_pass_same:    "New password must be different from the current one.",
    admin_pass_err:     "Error changing password:",

    // App
    app_loading:        "Loading…",
  },
} as const;

export type TranslationKey = keyof typeof translations["pt-BR"];

export const mapSupabaseError = (message: string, lang: Lang): string => {
  const maps: Record<string, Record<Lang, string>> = {
    "Invalid login credentials": {
      "pt-BR": translations["pt-BR"].login_err_invalid,
      "en-US": translations["en-US"].login_err_invalid,
    },
    "Email not confirmed": {
      "pt-BR": translations["pt-BR"].login_err_unconfirmed,
      "en-US": translations["en-US"].login_err_unconfirmed,
    },
    "over_email_send_rate_limit": {
      "pt-BR": translations["pt-BR"].login_err_too_many,
      "en-US": translations["en-US"].login_err_too_many,
    },
    "New password should be different from the old password": {
      "pt-BR": translations["pt-BR"].reset_err_same,
      "en-US": translations["en-US"].reset_err_same,
    },
    "Password should be at least 6 characters": {
      "pt-BR": translations["pt-BR"].reset_err_short,
      "en-US": translations["en-US"].reset_err_short,
    },
  };

  for (const [key, value] of Object.entries(maps)) {
    if (message.includes(key)) return value[lang];
  }
  return message;
};
