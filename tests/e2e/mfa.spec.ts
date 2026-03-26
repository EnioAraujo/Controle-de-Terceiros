import { test, expect } from "@playwright/test";
import { SUPABASE_URL } from "./helpers";

// ─── JWT falso com claim `aal` correto ────────────────────────────────────────
// O SDK do Supabase lê o campo `aal` diretamente do payload do JWT via decodeJWT().
// Por isso precisamos de um token base64url com payload válido. A assinatura é ignorada
// em testes pois o SDK não a verifica no cliente.

function makeJWT(aal: "aal1" | "aal2"): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "test-user-id",
      aud: "authenticated",
      role: "authenticated",
      aal,
      amr: [{ method: aal === "aal2" ? "totp" : "password", timestamp: 1648000000 }],
      exp: 9999999999,
      iat: 1648000000,
    })
  ).toString("base64url");
  return `${header}.${payload}.fake-sig`;
}

const AAL1_TOKEN = makeJWT("aal1");
const AAL2_TOKEN = makeJWT("aal2");

const BASE_USER = {
  id: "test-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

// Fator TOTP verificado (para mocks de usuário com MFA ativo)
const VERIFIED_FACTOR = {
  id: "factor-id-123",
  factor_type: "totp",
  status: "verified",
  friendly_name: "",
  created_at: "2026-03-26T00:00:00Z",
  updated_at: "2026-03-26T00:00:00Z",
};

// ─── Helpers de mock ─────────────────────────────────────────────────────────

/**
 * Simula login bem-sucedido com AAL1.
 * `withFactor` inclui/exclui o fator TOTP verificado no objeto user.
 *
 * Por que dois endpoints?
 * - POST /auth/v1/token  → signInWithPassword armazena o user internamente
 * - GET  /auth/v1/user   → listFactors() chama getUser() que bate aqui
 *   A listFactors() lê user.factors desta resposta para montar { totp: [...] }.
 */
async function mockSignIn(
  page: import("@playwright/test").Page,
  withFactor: boolean
) {
  const user = withFactor
    ? { ...BASE_USER, factors: [VERIFIED_FACTOR] }
    : { ...BASE_USER, factors: [] };

  await page.route(`${SUPABASE_URL}/auth/v1/token**`, (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: AAL1_TOKEN,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "fake-refresh",
          user,
        }),
      });
    } else {
      route.continue();
    }
  });

  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      });
    } else {
      route.continue();
    }
  });
}

/** Simula o endpoint de challenge TOTP para o fator existente. */
async function mockChallenge(page: import("@playwright/test").Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/factors/factor-id-123/challenge`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "challenge-id-456",
        expires_at: 9999999999,
        factor_id: "factor-id-123",
      }),
    });
  });
}

/**
 * Simula o endpoint de verify: código "123456" é aceito com AAL2,
 * qualquer outro retorna erro 422.
 */
async function mockVerify(page: import("@playwright/test").Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/factors/factor-id-123/verify`, (route) => {
    const body = JSON.parse(route.request().postData() || "{}") as { code?: string };
    if (body.code === "123456") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: AAL2_TOKEN,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "new-refresh",
          user: { ...BASE_USER, factors: [VERIFIED_FACTOR] },
        }),
      });
    } else {
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_mfa_code_attempt",
          message: "Invalid TOTP code",
        }),
      });
    }
  });
}

/**
 * Simula o fluxo completo de enrollment TOTP na MfaSetupPage:
 * enroll → challenge → verify → unenroll (usado no skip).
 */
async function mockEnrollFlow(page: import("@playwright/test").Page) {
  // POST /auth/v1/factors — enroll retorna QR code SVG e secret
  await page.route(`${SUPABASE_URL}/auth/v1/factors`, (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "new-factor-id",
          type: "totp",
          totp: {
            // SVG inline mínimo para o <img> renderizar sem erros
            qr_code:
              "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><rect width='100' height='100'/></svg>",
            secret: "JBSWY3DPEHPK3PXP",
            uri: "otpauth://totp/Controle%20Terceiros:test%40example.com?secret=JBSWY3DPEHPK3PXP",
          },
        }),
      });
    } else {
      route.continue();
    }
  });

  // POST /auth/v1/factors/new-factor-id/challenge
  await page.route(`${SUPABASE_URL}/auth/v1/factors/new-factor-id/challenge`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "enroll-challenge-id",
        expires_at: 9999999999,
        factor_id: "new-factor-id",
      }),
    });
  });

  // POST /auth/v1/factors/new-factor-id/verify — aceita qualquer código no setup
  await page.route(`${SUPABASE_URL}/auth/v1/factors/new-factor-id/verify`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: AAL2_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "new-refresh",
        user: { ...BASE_USER, factors: [{ ...VERIFIED_FACTOR, id: "new-factor-id" }] },
      }),
    });
  });

  // DELETE /auth/v1/factors/new-factor-id — unenroll chamado no handleSkip
  await page.route(`${SUPABASE_URL}/auth/v1/factors/new-factor-id`, (route) => {
    if (route.request().method() === "DELETE") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "new-factor-id" }),
      });
    } else {
      route.continue();
    }
  });
}

/** Intercepta o REST do Supabase com respostas vazias para evitar erros no app. */
async function mockRestData(page: import("@playwright/test").Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/**`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  );
}

/**
 * Injeta sessão AAL1 no localStorage antes de carregar a página.
 * Simula usuário já logado com email/senha mas sem MFA concluído.
 * - currentLevel = "aal1" (do JWT) → MfaSetupPage não redireciona para /
 * - factors: []              → MfaSetupPage inicia enrollment em vez de ir direto para verify
 */
async function injectAAL1Session(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ token, user }: { token: string; user: object }) => {
      const fakeSession = {
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: 9999999999,
        refresh_token: "fake-refresh",
        user,
      };
      localStorage.setItem("sb-jwleobxfonmdhfnvbkuf-auth-token", JSON.stringify(fakeSession));
      localStorage.setItem("lgpd_aceito", "1");
    },
    { token: AAL1_TOKEN, user: { ...BASE_USER, factors: [] } }
  );
}

/** Navega até o formulário de login clicando em 'Desktop'. */
async function gotoLoginForm(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("button:has-text('Desktop')").click();
  await expect(page.locator("input[type='email']").first()).toBeVisible({ timeout: 5000 });
}

/** Preenche e envia o formulário de login. */
async function fillAndSubmitLogin(page: import("@playwright/test").Page) {
  await page.locator("input[type='email']").fill("test@example.com");
  await page.locator("input[type='password']").fill("password123");
  await page.locator("button[type='submit']").first().click();
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRUPO 1 — Seleção de Dispositivo
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Seleção de Dispositivo", () => {
  test.beforeEach(async ({ page }) => {
    // Sem sessão → app redireciona para /login automaticamente
    await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "unauthorized" }),
      })
    );
  });

  test("exibe os cards Mobile e Desktop antes do formulário de login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("button:has-text('Mobile')").first()).toBeVisible();
    await expect(page.locator("button:has-text('Desktop')").first()).toBeVisible();
  });

  test("clicar em Desktop exibe o formulário de email e senha", async ({ page }) => {
    await page.goto("/login");
    await page.locator("button:has-text('Desktop')").click();
    await expect(page.locator("input[type='email']").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("input[type='password']").first()).toBeVisible({ timeout: 5000 });
  });

  test("clicar em Mobile exibe formulário com badge '📱 Mobile'", async ({ page }) => {
    await page.goto("/login");
    await page.locator("button:has-text('Mobile')").first().click();
    await expect(page.locator("input[type='email']").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("📱 Mobile").first()).toBeVisible({ timeout: 3000 });
  });

  test("'← Trocar tipo de acesso' volta para a seleção de dispositivo", async ({ page }) => {
    await page.goto("/login");
    await page.locator("button:has-text('Desktop')").click();
    await page.locator("button:has-text('Trocar tipo de acesso')").click();
    await expect(page.locator("button:has-text('Mobile')").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("button:has-text('Desktop')").first()).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GRUPO 2 — Redirecionamento pós-login por status MFA
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Login — Redirecionamento por status MFA", () => {
  test.beforeEach(async ({ page }) => {
    // Sem sessão antes de fazer login
    await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "unauthorized" }),
      })
    );
  });

  test("usuário sem TOTP é redirecionado para /mfa-setup", async ({ page }) => {
    await mockSignIn(page, false); // factors: []
    await mockRestData(page);

    await gotoLoginForm(page);
    await fillAndSubmitLogin(page);

    await expect(page).toHaveURL(/\/mfa-setup/, { timeout: 10000 });
  });

  test("usuário com TOTP verificado vê o campo de código TOTP", async ({ page }) => {
    await mockSignIn(page, true); // factors: [VERIFIED_FACTOR]
    await mockChallenge(page);

    await gotoLoginForm(page);
    await fillAndSubmitLogin(page);

    await expect(page.locator("input#mfa-code").first()).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GRUPO 3 — Challenge TOTP no Login
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Challenge TOTP no Login", () => {
  // Cada teste começa já na tela de challenge TOTP (step="mfa")
  test.beforeEach(async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "unauthorized" }),
      })
    );
    await mockSignIn(page, true);
    await mockChallenge(page);
    await mockVerify(page);

    await gotoLoginForm(page);
    await fillAndSubmitLogin(page);

    // Garante que estamos no step MFA antes de cada asserção
    await expect(page.locator("input#mfa-code").first()).toBeVisible({ timeout: 8000 });
  });

  test("botão 'Verificar' fica desabilitado com menos de 6 dígitos", async ({ page }) => {
    await page.locator("input#mfa-code").fill("123");
    const btn = page.locator("button[type='submit']").first();
    await expect(btn).toBeDisabled();
  });

  test("código TOTP inválido exibe mensagem de erro inline", async ({ page }) => {
    await page.locator("input#mfa-code").fill("000000");
    await page.locator("button[type='submit']").first().click();
    await expect(
      page.getByText(/Código inválido|Invalid code/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("código TOTP inválido mantém a tela de challenge", async ({ page }) => {
    await page.locator("input#mfa-code").fill("000000");
    await page.locator("button[type='submit']").first().click();
    await expect(page.locator("input#mfa-code").first()).toBeVisible({ timeout: 8000 });
  });

  test("código TOTP válido conclui o login e sai de /login", async ({ page }) => {
    await mockRestData(page);
    await page.locator("input#mfa-code").fill("123456");
    await page.locator("button[type='submit']").first().click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("'← Voltar ao login' restaura o formulário de credenciais", async ({ page }) => {
    await page.locator("button:has-text('Voltar ao login')").click();
    await expect(page.locator("input[type='email']").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("input[type='password']").first()).toBeVisible({ timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GRUPO 4 — MfaSetupPage: Enrollment de TOTP
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("MfaSetupPage — Enrollment de TOTP", () => {
  test.beforeEach(async ({ page }) => {
    // Sessão AAL1 no localStorage: usuário logado, sem MFA
    await injectAAL1Session(page);

    // GET /auth/v1/user → user sem fatores
    // - getAuthenticatorAssuranceLevel() lê aal1 do JWT → não redireciona para /
    // - listFactors() → totp: [] → MfaSetupPage inicia enrollment (não vai para "verify" direto)
    await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...BASE_USER, factors: [] }),
      });
    });

    await mockRestData(page);
    await mockEnrollFlow(page);
  });

  test("exibe QR code após iniciar o enrollment", async ({ page }) => {
    await page.goto("/mfa-setup");
    await expect(page.locator("img[alt*='QR']").first()).toBeVisible({ timeout: 8000 });
  });

  test("exibe a chave secreta manual abaixo do QR code", async ({ page }) => {
    await page.goto("/mfa-setup");
    await expect(page.getByText("JBSWY3DPEHPK3PXP").first()).toBeVisible({ timeout: 8000 });
  });

  test("botão 'Já escaneei' avança para o campo de código TOTP", async ({ page }) => {
    await page.goto("/mfa-setup");
    await page.locator("img[alt*='QR']").first().waitFor({ state: "visible", timeout: 8000 });
    await page.locator("button:has-text('escaneei')").first().click();
    await expect(page.locator("input#totp-code").first()).toBeVisible({ timeout: 5000 });
  });

  test("botão de ativar fica desabilitado com menos de 6 dígitos", async ({ page }) => {
    await page.goto("/mfa-setup");
    await page.locator("img[alt*='QR']").first().waitFor({ state: "visible", timeout: 8000 });
    await page.locator("button:has-text('escaneei')").first().click();
    await page.locator("input#totp-code").fill("123");
    const btn = page.locator("button[type='submit']").first();
    await expect(btn).toBeDisabled();
  });

  test("'Ver o QR Code novamente' volta ao passo anterior", async ({ page }) => {
    await page.goto("/mfa-setup");
    await page.locator("img[alt*='QR']").first().waitFor({ state: "visible", timeout: 8000 });
    await page.locator("button:has-text('escaneei')").first().click();
    await page.locator("button:has-text('QR Code novamente'), button:has-text('See the QR code')").first().click();
    await expect(page.locator("img[alt*='QR']").first()).toBeVisible({ timeout: 5000 });
  });

  test("código correto exibe a tela de sucesso 'Autenticação ativada'", async ({ page }) => {
    await page.goto("/mfa-setup");
    await page.locator("img[alt*='QR']").first().waitFor({ state: "visible", timeout: 8000 });
    await page.locator("button:has-text('escaneei')").first().click();
    await page.locator("input#totp-code").fill("123456");
    await page.locator("button[type='submit']").first().click();
    await expect(
      page.getByText(/Autenticação ativada|Authentication enabled/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("'Configurar mais tarde' chama unenroll e sai da tela de setup", async ({ page }) => {
    await page.goto("/mfa-setup");
    await page.locator("img[alt*='QR']").first().waitFor({ state: "visible", timeout: 8000 });
    await page
      .locator("button:has-text('mais tarde'), button:has-text('Set up later')")
      .first()
      .click();
    await expect(page).not.toHaveURL(/\/mfa-setup/, { timeout: 8000 });
  });

  test("sem sessão, /mfa-setup redireciona para /login", async ({ page }) => {
    // Sobrescreve o GET /auth/v1/user para retornar 401 (sem sessão válida)
    await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "unauthorized" }),
      })
    );
    // Limpa localStorage antes de navegar (sem injectAAL1Session para este teste)
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/mfa-setup");
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });
});
