import { Page } from "@playwright/test";

// URL base do Supabase (interceptada via page.route)
export const SUPABASE_URL = "https://jwleobxfonmdhfnvbkuf.supabase.co";

// Token JWT de sessão fictício para testes
export const FAKE_TOKEN = "fake.test.token";

// Resposta padrão de sessão autenticada (usuário comum)
export const FAKE_SESSION = {
  access_token: FAKE_TOKEN,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "fake-refresh",
  user: {
    id: "test-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
};

// Resposta padrão de sessão de admin
export const FAKE_ADMIN_SESSION = {
  ...FAKE_SESSION,
  user: { ...FAKE_SESSION.user, id: "admin-user-id", email: "admin@example.com" },
};

/**
 * Intercepta chamadas Supabase Auth para simular sessão já autenticada.
 * Deve ser chamado antes de page.goto().
 */
export async function mockAuthenticatedSession(page: Page, admin = false) {
  const session = admin ? FAKE_ADMIN_SESSION : FAKE_SESSION;

  // GET /auth/v1/user  — verifica token atual
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session.user),
    });
  });

  // POST /auth/v1/token?grant_type=refresh_token — renovação de token
  await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
    });
  });

  // Mock RPC is_admin
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(admin),
    });
  });

  // Mock profiles query
  await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: session.user.id, is_admin: admin, is_approved: true }]),
    });
  });
}

/**
 * Intercepta tabelas básicas do app com dados mínimos.
 */
export async function mockAppData(page: Page) {
  // Registros vazios
  await page.route(`${SUPABASE_URL}/rest/v1/registros**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  // Opções padrão
  await page.route(`${SUPABASE_URL}/rest/v1/opcoes**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, chave: "turnos", valor: "1º Turno" },
        { id: 2, chave: "turnos", valor: "2º Turno" },
      ]),
    });
  });

  // Terceiros vazio
  await page.route(`${SUPABASE_URL}/rest/v1/terceiros**`, (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // turnos_config e diarias_config
  await page.route(`${SUPABASE_URL}/rest/v1/turnos_config**`, (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route(`${SUPABASE_URL}/rest/v1/diarias_config**`, (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // audit_log — insert aceito
  await page.route(`${SUPABASE_URL}/rest/v1/audit_log**`, (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify([]) });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }
  });
}
