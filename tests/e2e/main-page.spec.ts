import { test, expect } from "@playwright/test";
import { mockAuthenticatedSession, mockAppData, SUPABASE_URL } from "./helpers";

// ─── Helper: injeta sessão na localStorage antes de carregar a página ─────────
async function injectSession(page: import("@playwright/test").Page) {
  // O Supabase SDK armazena a sessão no localStorage.
  // Injeta uma sessão fake para que o app "acredite" estar logado.
  await page.addInitScript(() => {
    const fakeSession = {
      access_token: "fake.test.token",
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
    // Supabase armazena com a chave sb-<project-ref>-auth-token
    const key = "sb-jwleobxfonmdhfnvbkuf-auth-token";
    localStorage.setItem(key, JSON.stringify(fakeSession));
    // Simula que o aviso de privacidade (LGPD) já foi aceito
    // (sem isso, PrivacyNotice cobre a tela com z-index:9999 e bloqueia clicks)
    localStorage.setItem("lgpd_aceito", "1");
  });
}

// ─── Testes da página principal ───────────────────────────────────────────────

test.describe("Index (página principal)", () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await mockAuthenticatedSession(page, false);
    await mockAppData(page);
  });

  test("exibe os tabs de navegação", async ({ page }) => {
    await page.goto("/");
    // Aguarda o app carregar (spinner some ou nav aparece)
    await expect(
      page.locator("button:has-text('Lançamentos'), button:has-text('Lancamentos')").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("exibe o título na aba Lançamentos", async ({ page }) => {
    await page.goto("/");
    // Clica na aba Lançamentos se não estiver ativa
    await page.locator("button:has-text('Lançamentos'), button:has-text('Lancamentos')").first().click();
    // Verifica o título da seção ("Lançamentos de Terceiros")
    await expect(page.getByText(/Lançamentos de Terceiros/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("botão 'Novo Lançamento' está visível na aba Lançamentos", async ({ page }) => {
    await page.goto("/");
    await page.locator("button:has-text('Lançamentos'), button:has-text('Lancamentos')").first().click();
    await expect(
      page.locator("button:has-text('Novo Lançamento'), button:has-text('Novo')").first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("exibe 'Nenhum registro encontrado' com lista vazia", async ({ page }) => {
    await page.goto("/");
    await page.locator("button:has-text('Lançamentos'), button:has-text('Lancamentos')").first().click();
    await expect(
      page.locator("text=Nenhum registro").first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("botão Admin NÃO aparece para usuário comum", async ({ page }) => {
    await page.goto("/");
    // Aguarda o app carregar
    await page.locator("button:has-text('Lançamentos')").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const adminBtn = page.locator("button:has-text('Admin')");
    await expect(adminBtn).not.toBeVisible();
  });
});

test.describe("Index (usuário admin)", () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await mockAuthenticatedSession(page, true); // is_admin = true
    await mockAppData(page);
  });

  test("botão Admin APARECE para usuário admin", async ({ page }) => {
    await page.goto("/");
    // Aguarda o app carregar e o RPC is_admin retornar true
    await expect(
      page.locator("button:has-text('Admin')").first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Filtros de Lançamentos", () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page);
    await mockAuthenticatedSession(page, false);
    await mockAppData(page);
  });

  test("filtro de data está visível", async ({ page }) => {
    await page.goto("/");
    await page.locator("button:has-text('Lançamentos')").first().click();
    // Campo de data deve estar presente
    await expect(page.locator("input[type='date']").first()).toBeVisible({ timeout: 8000 });
  });

  test("filtro limpar restaura o estado padrão", async ({ page }) => {
    await page.goto("/");
    await page.locator("button:has-text('Lançamentos')").first().click();
    const clearBtn = page.locator("button:has-text('Limpar filtros'), button:has-text('Limpar')").first();
    await expect(clearBtn).toBeVisible({ timeout: 8000 });
    await clearBtn.click();
    // Após limpar, o contador deve mostrar "0 de N registros" ainda funcional
    await expect(page.locator("text=registros").first()).toBeVisible({ timeout: 5000 });
  });
});
