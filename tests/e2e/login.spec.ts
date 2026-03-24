import { test, expect } from "@playwright/test";
import { SUPABASE_URL } from "./helpers";

// ─── Mocks de autenticação ────────────────────────────────────────────────────

async function mockNoSession(page: import("@playwright/test").Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { session: null }, error: null }),
    });
  });
}

async function mockLoginSuccess(page: import("@playwright/test").Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "fake.test.token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "fake-refresh",
          user: {
            id: "test-user-id",
            email: "test@example.com",
            role: "authenticated",
            aud: "authenticated",
            email_confirmed_at: "2026-01-01T00:00:00Z",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockLoginError(page: import("@playwright/test").Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
      });
    } else {
      route.continue();
    }
  });
}

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe("LoginPage", () => {
  test.beforeEach(async ({ page }) => {
    // Sem sessão → redireciona para /login
    await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "JWT expired" }) })
    );
  });

  test("renderiza os campos de email e senha", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email'], input[placeholder*='mail'], input[name='email']").first()).toBeVisible();
    await expect(page.locator("input[type='password']").first()).toBeVisible();
  });

  test("botão de login está visível e habilitado", async ({ page }) => {
    await page.goto("/login");
    const btn = page.locator("button[type='submit'], button:has-text('Entrar'), button:has-text('Login')").first();
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("exibe erro com credenciais inválidas", async ({ page }) => {
    await mockLoginError(page);
    await page.goto("/login");

    await page.locator("input[type='email'], input[placeholder*='mail']").first().fill("wrong@example.com");
    await page.locator("input[type='password']").first().fill("wrongpassword");
    await page.locator("button[type='submit'], button:has-text('Entrar'), button:has-text('Login')").first().click();

    // Aguarda mensagem de erro inline — a div usa cor #E02424 e texto "E-mail ou senha incorretos."
    // Usamos regex para ser agnóstico ao idioma
    await expect(
      page.getByText(/incorretos|Incorrect|inválido|invalid/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("login bem-sucedido redireciona para página principal", async ({ page }) => {
    await mockLoginSuccess(page);
    // Mock das chamadas pós-login
    await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
    );
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/**`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(false) })
    );

    await page.goto("/login");
    await page.locator("input[type='email'], input[placeholder*='mail']").first().fill("test@example.com");
    await page.locator("input[type='password']").first().fill("password123");
    await page.locator("button[type='submit'], button:has-text('Entrar'), button:has-text('Login')").first().click();

    // Deve sair da rota /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });
});
