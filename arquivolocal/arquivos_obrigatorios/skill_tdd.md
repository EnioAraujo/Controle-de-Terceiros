---
name: webapp-testing-tdd
description: >
  Toolkit integrado para testes de aplicações web usando TDD, Playwright e automação.
  Suporta verificação de funcionalidade frontend, debugging de comportamento UI, captura
  de screenshots, testes contra regressão, sharding em CI, trace viewer e estratégias
  modernas de locators (getByRole, getByLabel) recomendadas pela equipe Playwright em 2026.
license: Complete terms in LICENSE.txt
---

# Testes de Aplicações Web com TDD + Playwright (2026 Edition)

Combine **Test-Driven Development (TDD)** com **Playwright** para evoluir código web com segurança, confiança e rapidez.

> **Última atualização:** Maio de 2026
> **Baseado em:** Playwright official best practices · BrowserStack 2026 selector guide · TestDino TDD patterns

---

## 🎯 Objetivo da Skill

Ensinar como aplicar TDD na prática usando Playwright, garantindo:
- ✅ Código seguro e testável desde o início
- ✅ Refatoração sem medo de quebrar funcionalidades
- ✅ Design emergente a partir dos testes
- ✅ Uso de IA como copiloto (gerar testes, edge cases, mocks)
- ✅ Locators resilientes a mudanças de UI (estratégia 2026: user-facing > test-id > CSS)
- ✅ CI scaling com sharding e tracing inteligente

---

# 🧩 1. Ciclo Fundamental do TDD (Red → Green → Refactor)

## 1️⃣ RED – Escreva um teste que falha

Defina o comportamento desejado **antes** do código.

```typescript
// tests/forms.spec.ts
import { test, expect } from '@playwright/test';

test('formulário valida email inválido', async ({ page }) => {
  await page.goto('/form');
  await page.getByLabel('Email').fill('email-invalido');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('alert')).toContainText('Email inválido');
});
```

**Rode o teste e confirme que falha** ✓

```bash
npx playwright test tests/forms.spec.ts
# Resultado: FAIL ❌ (esperado)
```

---

## 2️⃣ GREEN – Escreva o código mínimo para passar o teste

Implementação simples e direta:

```javascript
// src/utils/validation.js
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmail(email) {
  return EMAIL_REGEX.test(email.trim());
}
```

```jsx
// src/components/Form.jsx
import { validateEmail } from '../utils/validation';

function Form() {
  const [error, setError] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateEmail(email)) setError('Email inválido');
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" />
      {error && <div role="alert">{error}</div>}
      <button type="submit">Enviar</button>
    </form>
  );
}
```

**Rode os testes e confirme que passam** ✓

---

## 3️⃣ REFACTOR – Melhore o código mantendo os testes verdes

Limpe nomes, extraia componentes, remova duplicações:

```javascript
// Antes (acoplado)
function Form() {
  const [error, setError] = useState('');
  // ... validação inline
}

// Depois (separação de responsabilidades)
function useFormValidation(schema) {
  const [errors, setErrors] = useState({});
  const validate = (data) => {
    const result = schema.safeParse(data);
    setErrors(result.success ? {} : result.error.flatten());
    return result.success;
  };
  return { errors, validate };
}

function Form() {
  const { errors, validate } = useFormValidation(EmailSchema);
  // ... componente focado em UI
}
```

**Garanta que todos os testes continuam passando** ✓

---

# 🧪 2. Tipos Essenciais de Testes no TDD

### ✅ Testes de Unidade

Focados em funções e regras isoladas. Use **Vitest** (recomendado em 2026 para Vite/React) ou Jest:

```typescript
// tests/unit/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail } from '../src/utils/validation';

describe('validateEmail', () => {
  it.each([
    ['user@example.com', true],
    ['user.name+tag@example.co.uk', true],
    ['invalid', false],
    ['@example.com', false],
    ['user@', false],
    ['', false],
  ])('validateEmail(%s) === %s', (input, expected) => {
    expect(validateEmail(input)).toBe(expected);
  });
});
```

**Benefício**: Testes rápidos, fáceis de debugar, ótimos para regras de negócio.

---

### ✅ Testes de Integração (E2E com Playwright)

Garantem que múltiplas partes trabalham juntas:

```typescript
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('fluxo completo de login', async ({ page }) => {
  await page.goto('/login');

  // Preenche formulário usando user-facing locators (recomendação 2026)
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Web-first assertion — espera automaticamente
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Logout
  await page.getByRole('button', { name: /sair|logout/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});
```

**Benefício**: Valida comportamento real do usuário, end-to-end.

---

### ✅ Testes contra Regressão

Encontrou um bug? Escreva um teste que o reproduza **antes** da correção:

```typescript
test('REGRESSÃO #142 — Dropdown não abre na segunda clicagem', async ({ page }) => {
  await page.goto('/dashboard');

  const dropdown = page.getByRole('button', { name: 'Menu' });
  const menuOptions = page.getByRole('menu');

  // Primeira abertura
  await dropdown.click();
  await expect(menuOptions).toBeVisible();

  // Fecha clicando fora
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await expect(menuOptions).not.toBeVisible();

  // Segunda abertura (bug estava aqui)
  await dropdown.click();
  await expect(menuOptions).toBeVisible();
});
```

**Benefício**: Garante que o bug não ressurge.

---

# 🎯 3. Estratégia de Locators (Best Practice 2026)

A equipe Playwright e o consenso da comunidade em 2026 estabelecem uma **hierarquia clara**:

| Prioridade | Estratégia | Quando usar |
|-----------|-----------|-------------|
| 🥇 1 | `getByRole()` | **Sempre que possível** — espelha como usuários e tecnologias assistivas percebem a página |
| 🥈 2 | `getByLabel()` | Form fields com label associado |
| 🥉 3 | `getByPlaceholder()` | Inputs sem label mas com placeholder |
| 4 | `getByText()` | Conteúdo visível ao usuário (cuidado com i18n) |
| 5 | `getByAltText()` | Imagens com texto alternativo |
| 6 | `getByTitle()` | Elementos com atributo `title` |
| 7 | `getByTestId()` | Quando os anteriores não bastam — defina contrato explícito com a equipe |
| ⚠️ 8 | `locator('css=...')` | Fallback raro |
| ❌ 9 | `locator('xpath=...')` | **Evite** — frágil, lento, acoplado ao DOM |

**Por quê?** Locators baseados em estrutura DOM (CSS, XPath) quebram quando:
- Componentes re-renderizam após hidratação
- CSS-in-JS gera hashes novos a cada build
- Mobile esconde labels que desktop usa
- Frameworks reorganizam o DOM (React 19, Vue 3, Angular signals)

```typescript
// ❌ Frágil — depende de classes/estrutura
await page.locator('button.bg-primary.add-to-cart').click();
await page.locator('div > div:nth-child(2) > input').fill('valor');

// ✅ Resiliente — semântica
await page.getByRole('button', { name: /adicionar ao carrinho/i }).click();
await page.getByLabel('CEP').fill('30130-100');
```

**Filtragem e encadeamento (chaining):**

```typescript
// Encontrar item específico em uma lista
const product = page
  .getByRole('listitem')
  .filter({ hasText: 'Camiseta Preta P' });

await product.getByRole('button', { name: 'Adicionar' }).click();

// Múltiplos critérios
await page
  .getByRole('row', { name: /Pedido #1042/ })
  .getByRole('button', { name: 'Editar' })
  .click();
```

**Test IDs quando necessário** (use `data-testid` ou customize via config):

```typescript
// playwright.config.ts
export default defineConfig({
  use: { testIdAttribute: 'data-testid' },
});

// Uso
await page.getByTestId('submit-button').click();

// Em componentes React, defina IDs estáveis para elementos dinâmicos:
<button data-testid="kanban-card-drag-handle">Arrastar</button>
```

---

# 🪄 4. Web-First Assertions

Assertions do Playwright **esperam automaticamente** até a condição ser verdadeira (com timeout). Sempre prefira a forma `expect(locator).toX()` sobre asserções síncronas:

```typescript
// ❌ Síncrono — não espera, gera flakiness
const text = await page.locator('.message').textContent();
expect(text).toBe('Salvo');

// ✅ Web-first — espera até 5s (default) pelo elemento aparecer e ter o texto
await expect(page.getByRole('alert')).toHaveText('Salvo');
```

**Assertions essenciais:**

```typescript
// Visibilidade e estado
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();
await expect(locator).toBeChecked();
await expect(locator).toBeFocused();

// Conteúdo
await expect(locator).toHaveText('exato');
await expect(locator).toContainText(/regex/);
await expect(locator).toHaveValue('input value');
await expect(locator).toHaveAttribute('href', /\/dashboard/);
await expect(locator).toHaveCount(5);
await expect(locator).toHaveClass(/active/);

// Página
await expect(page).toHaveURL(/\/success$/);
await expect(page).toHaveTitle('Dashboard | Supporte');

// Custom timeout quando necessário (default 5s)
await expect(locator).toBeVisible({ timeout: 15_000 });
```

---

# 🔄 5. Decision Tree: Escolhendo Sua Abordagem

```
Tarefa → É HTML estático?
    ├─ Sim → Leia arquivo HTML diretamente
    │         ├─ Sucesso → Escreva teste com Playwright
    │         └─ Falha → Trate como dinâmica (abaixo)
    │
    └─ Não (webapp dinâmica) → Servidor já está rodando?
        ├─ Não → Configure webServer no playwright.config.ts
        │        ou use scripts/with_server.py
        │
        └─ Sim → Padrão Reconhecimento-Depois-Ação:
            1. Navegue e use page.waitForLoadState('networkidle') ou web-first assertions
            2. Use Codegen ou Pick Locator (UI Mode) para identificar locators
            3. Identifique role/label/text do estado renderizado
            4. Execute ações com locators user-facing
            5. Escreva teste TDD para validar comportamento
```

**Configuração do webServer (padrão recomendado 2026):**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',         // ← grava trace só se o teste falhar
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'mobile',   use: { ...devices['iPhone 14'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

---

# 🚀 6. Workflow Prático Recomendado

### Cenário 1: Desenvolvendo uma nova feature com TDD

```bash
# 1. Defina o micro-objetivo
# "Usuário deve poder adicionar item à lista com Enter"

# 2. Escreva o teste (RED)
npx playwright test tests/todo-add.spec.ts --headed

# Resultado: FAIL ❌

# 3. Implemente o mínimo (GREEN)
# ... edite src/components/TodoList.jsx ...

# 4. Rode o teste novamente
npx playwright test tests/todo-add.spec.ts

# Resultado: PASS ✅

# 5. Refatore com confiança (REFACTOR)
# ... limpe o código, extraia métodos ...

# 6. Confirme que tudo continua verde
npx playwright test

# 7. Commite
git commit -m "feat: adicionar item à lista com Enter"
```

---

### Cenário 2: Debugando com UI Mode (recomendado em 2026)

```bash
# UI Mode oferece time-travel debugging — DOM snapshots, network, console
npx playwright test --ui

# Trace viewer para falhas em CI
npx playwright show-trace test-results/.../trace.zip

# Codegen para gravar testes interativamente
npx playwright codegen http://localhost:5173

# VS Code Extension — pick locator com hover
# (instale "Playwright Test for VSCode")
```

---

# 🛠️ 7. Estratégias para CI/CD

### Sharding para suites grandes

Para 500+ testes, distribua entre múltiplas máquinas:

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1/4, 2/4, 3/4, 4/4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --shard=${{ matrix.shard }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
          retention-days: 30
```

### API seeding em vez de UI login

Logar via UI a cada teste é lento e frágil. Seed via API:

```typescript
// tests/fixtures/auth.ts
import { test as base } from '@playwright/test';

type AuthFixture = { authenticatedPage: Page };

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page, request }, use) => {
    // Login via API — gera cookie/token diretamente
    const response = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'test123' }
    });
    const { token } = await response.json();

    await page.context().addCookies([{
      name: 'session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    }]);

    await use(page);
  },
});
```

```typescript
// Uso
import { test, expect } from './fixtures/auth';

test('admin pode editar usuário', async ({ authenticatedPage: page }) => {
  await page.goto('/admin/users');
  // já está logado, sem fluxo de UI
});
```

---

# 🔍 8. Padrão de Reconhecimento-Depois-Ação

Use quando precisar debugar ou explorar um componente novo:

### Passo 1: Inspecione o DOM renderizado com Codegen ou Pick Locator

```bash
# Gera locators ao clicar
npx playwright codegen http://localhost:5173/dashboard

# Ou abra UI Mode e use o picker (botão de mira)
npx playwright test --ui
```

### Passo 2: Identifique o melhor locator (hierarquia)

```typescript
// Estratégias em ordem de preferência (recapitulando)
page.getByRole('button', { name: 'Enviar' });   // 🥇 user-facing
page.getByLabel('Email');                        // 🥈 form fields
page.getByText('Bem-vindo');                     // 🥉 conteúdo
page.getByTestId('submit-btn');                  // contrato explícito
page.locator('css=.modal');                      // fallback
```

### Passo 3: Execute ações e capture efeitos

```typescript
await page.getByTestId('menu-toggle').click();
await expect(page.getByRole('menu')).toBeVisible();
await page.screenshot({ path: 'menu-aberto.png', fullPage: true });
```

### Passo 4: Transforme em teste TDD

```typescript
test('menu abre ao clicar', async ({ page }) => {
  await page.goto('/');

  const menu = page.getByRole('menu');
  await expect(menu).not.toBeVisible();

  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(menu).toBeVisible();

  // Acessibilidade — bonus
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
});
```

---

# ⚡ 9. Princípios Estratégicos

## ✅ Comece sempre pelo comportamento externo

Pergunte: **"O que precisa acontecer?"** → transforme em teste:

```typescript
// ❌ Errado: pensar em "como" antes de "o quê"
// function implementarCache()...

// ✅ Certo: definir o comportamento esperado
test('lista carrega em menos de 500ms', async ({ page }) => {
  const start = Date.now();
  await page.goto('/lista');
  await expect(page.getByTestId('item-1')).toBeVisible();
  expect(Date.now() - start).toBeLessThan(500);
});
```

---

## ✅ Testes pequenos e focados

Um teste deve validar **um único comportamento**:

```typescript
// ❌ Muitos comportamentos em um teste
test('formulário', async ({ page }) => {
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Senha').fill('senha123');
  await page.getByLabel('Nome').fill('João');
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('img', { name: 'Avatar' })).toBeVisible();
  await expect(page.getByText('Bem-vindo')).toBeVisible();
});

// ✅ Um comportamento por teste
test('email obrigatório', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page.getByRole('alert')).toContainText('Email obrigatório');
});

test('redireciona para dashboard após cadastro', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
```

---

## ✅ Use IA como parceira (com responsabilidade)

Peça ao Claude (ou outro AI assistant) para:
- 🤖 Gerar testes a partir de um componente
- 🤖 Sugerir edge cases
- 🤖 Criar mocks/stubs e fixtures
- 🤖 Refatorar mantendo testes verdes
- 🤖 Debugar falhas de teste (anexe trace zip + screenshots)
- 🤖 Converter testes legados (Jest/Cypress) para Playwright

**Mas sempre verifique e valide o resultado!** Outputs de IA podem:
- Fabricar APIs que não existem (slopsquatting de imports)
- Sugerir locators frágeis (CSS específicos da iteração atual)
- Gerar assertions otimistas (sem cobrir edge cases)

---

## ✅ Confie nos testes para evoluir o design

O design emergirá naturalmente conforme os testes pedem:

```typescript
// Teste 1: Login básico
test('login válido leva ao dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

// Teste 2: Erro de validação
test('email inválido mostra erro', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('invalido');
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('Email inválido');
});

// Teste 3: Rate limiting
test('rate limit após 5 tentativas falhas', async ({ page }) => {
  await page.goto('/login');
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Senha').fill('senhaerrada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForTimeout(500);
  }
  await expect(page.getByRole('alert')).toContainText('Muitas tentativas');
});

// O design emerge: validação, feedback visual, throttling, mensagens semânticas...
```

---

# 🔧 10. Identificação de Verbosidade e Over-Engineering

Antes de refatorar, identifique **o que realmente merece refatoração**.

## 🔴 5 Padrões de Alerta

### 1️⃣ Lógica Duplicada

O mesmo bloco de código aparece em 2+ lugares:

```typescript
// ❌ Duplicado entre testes
test('email A válido', () => {
  const email = 'user@example.com';
  expect(email.includes('@')).toBe(true);
  expect(email.split('@')[1].includes('.')).toBe(true);
});

test('email B em formulário', () => {
  const email = 'form@example.com';
  expect(email.includes('@')).toBe(true);
  expect(email.split('@')[1].includes('.')).toBe(true);
});
```

**Solução:**

```typescript
// ✅ Helper compartilhado
function isEmailValid(email: string): boolean {
  const parts = email.split('@');
  return parts.length === 2 && parts[1].includes('.');
}

test('email A válido', () => expect(isEmailValid('user@example.com')).toBe(true));
test('email B em formulário', () => expect(isEmailValid('form@example.com')).toBe(true));
```

Em Playwright, use **fixtures** para setup compartilhado:

```typescript
const test = base.extend({
  loggedInUser: async ({ page }, use) => {
    await login(page, 'user@example.com', 'senha123');
    await use(page);
  },
});
```

---

### 2️⃣ Dependências Mortas

Biblioteca instalada mas não usada — cria superfície de ataque (ver skill de segurança, A03 Supply Chain):

```typescript
// ❌ Imports não usados
import unusedLibrary from 'unused-library';
import { test, expect } from '@playwright/test';
```

**Solução:**

```bash
# Auditar com depcheck
npx depcheck

# Remover
npm uninstall unused-library
```

---

### 3️⃣ Wrappers Desnecessários

Componente que apenas re-renderiza um filho:

```jsx
// ❌ Wrapper inútil
function Card({ children }) {
  return <div>{children}</div>;
}
```

**Solução:**

```jsx
// ✅ Use o div diretamente OU agregue valor
function Card({ children, title, variant = 'default' }) {
  return (
    <article className={`card card--${variant}`} role="region" aria-labelledby="card-title">
      {title && <h2 id="card-title">{title}</h2>}
      {children}
    </article>
  );
}
```

---

### 4️⃣ Estilos Inline Repetidos

```jsx
// ❌ Repetido
<button style={{ padding: '8px 16px', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
  Enviar
</button>
```

**Solução com Tailwind ou CSS classes:**

```jsx
// ✅ Tailwind classes
<button className="px-4 py-2 text-white text-sm font-bold">Enviar</button>

// ou ✅ componente reutilizável
<Button variant="primary">Enviar</Button>
```

---

### 5️⃣ Arquivo Monolítico

Arquivo único com +1500 linhas misturando hooks, UI, lógica de negócio (ver A06 — Insecure Design da skill de segurança):

**Solução:**

```typescript
// src/hooks/useDashboardData.ts
export function useDashboardData() { /* lógica de dados */ }

// src/utils/formatters.ts
export function formatDate(date: Date) { /* ... */ }
export function validateInput(input: string) { /* ... */ }

// src/pages/Dashboard.tsx (≤ 100 linhas)
export function Dashboard() {
  const { data, filter, fetchData } = useDashboardData();
  return <DashboardView data={data} filter={filter} />;
}
```

---

## ✅ Checklist Diagnóstico

Faça estas perguntas **antes** de qualquer refatoração:

- [ ] Essa dependência é **realmente usada** em algum ponto?
- [ ] Esse bloco de código **existe em 2+ lugares** com mínimas variações?
- [ ] Esse wrapper/componente **acrescenta algo** além de passar props?
- [ ] Esse estilo inline tem **4+ atributos** repetidos **5+ vezes**?
- [ ] Esse arquivo tem **+1000 linhas** misturando responsabilidades?
- [ ] Ao escrever o teste desta função, precisei importar **coisas demais** do mesmo arquivo?
- [ ] Os locators do teste dependem de **estrutura DOM** em vez de role/label?

**Se respondeu SIM a qualquer pergunta → merece refatoração.**

---

## 🔁 Fluxo Recomendado de Refatoração com TDD

1. **Identificar** o problema usando o checklist
2. **Escrever teste** que valida o comportamento atual (RED do TDD)
3. **Refatorar** mantendo o teste verde (REFACTOR do TDD)
4. **Confirmar** que `npx playwright test` ou `npm test` continua passando
5. **Commitar** como `refactor(escopo): descrição`

```bash
git commit -m "refactor(dashboard): extrair useDashboardData hook para modularizar"
```

---

# 🌐 11. Testes de Acessibilidade (Recomendação 2026)

Use locators baseados em role como **força dupla**: testam funcionalidade E acessibilidade:

```typescript
test('formulário acessível', async ({ page }) => {
  await page.goto('/signup');

  // Inputs com labels associados (getByLabel falha se não houver)
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Senha').fill('senha123');

  // Botão com nome acessível (não pode ser apenas ícone sem aria-label)
  await page.getByRole('button', { name: 'Cadastrar' }).click();

  // Mensagens de erro com role="alert" (announced para screen readers)
  await expect(page.getByRole('alert')).toBeVisible();
});

// Auditoria automatizada com @axe-core/playwright
import AxeBuilder from '@axe-core/playwright';

test('página sem violações WCAG', async ({ page }) => {
  await page.goto('/dashboard');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

---

# 📋 12. Checklist Prático da Skill

Use este checklist antes de submeter qualquer feature ou refatoração:

### Desenvolvimento com TDD

- [ ] Escrevi o teste **antes** do código?
- [ ] O teste falhou primeiro? (RED ✓)
- [ ] Fiz o mínimo para passar? (GREEN ✓)
- [ ] Refatorei mantendo testes verdes? (REFACTOR ✓)
- [ ] Evitei código sem propósito?
- [ ] Os testes **comunicam** o comportamento esperado?
- [ ] Usei IA como apoio, não como autoridade?

### Qualidade de Testes

- [ ] Cada teste valida **um único comportamento**?
- [ ] Os testes cobrem **happy path + edge cases + error cases**?
- [ ] Os testes funcionam isoladamente (ordem não importa)?
- [ ] Locators no Playwright são **user-facing** (`getByRole`/`getByLabel` antes de `getByTestId`)?
- [ ] Usei **web-first assertions** (`expect(locator).toX()` em vez de `expect(await ...)` síncrono)?
- [ ] Estado entre testes é resetado (fixtures, beforeEach)?

### Performance e CI

- [ ] Testes paralelos quando possível (`fullyParallel: true`)?
- [ ] Sharding configurado para suites grandes (500+ testes)?
- [ ] Trace gravado apenas em retry (`trace: 'on-first-retry'`)?
- [ ] API seeding em vez de UI login para autenticação?
- [ ] Browsers instalados via `npx playwright install --with-deps`?

### Acessibilidade

- [ ] Locators baseados em role/label (validam acessibilidade indiretamente)?
- [ ] Testes com `@axe-core/playwright` para violações WCAG?
- [ ] Mensagens de erro com `role="alert"`?

### Refatoração

- [ ] Identifiquei padrões de alerta (duplicação, wrappers, monolitos)?
- [ ] Escrevi testes **antes** de refatorar?
- [ ] Todos os testes continuam passando?
- [ ] Commit é **production-ready**?

---

# 🏁 Conclusão

TDD não é sobre testes. É sobre **evoluir código com segurança, confiança e rapidez**.

Combine:
- 🧪 **Testes como especificação** (antes do código)
- 🎬 **Playwright para automação real** (UI e fluxos de usuário)
- 🎯 **Locators user-facing** (resilientes a mudanças, validam acessibilidade)
- 🪄 **Web-first assertions** (eliminam flakiness)
- 🔄 **Refatoração contínua** (identificando e limpando dívida técnica)
- ⚡ **Sharding e tracing inteligente** (CI escalável)
- 🤖 **IA como copilota** (sugestões, edge cases, debugging — sempre validada)

E você terá uma base sólida para evoluir qualquer aplicação web.

---

# 📚 Referências e Exemplos

**Documentação oficial:**
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright UI Mode](https://playwright.dev/docs/test-ui-mode)
- [Vitest](https://vitest.dev/)
- [@axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright)

**Arquivos de exemplo disponíveis em `examples/`:**
- `element_discovery.ts` — Descobrir elementos com Codegen e Pick Locator
- `static_html_automation.ts` — Automação com HTML local
- `console_logging.ts` — Capturar logs do console
- `e2e_test_example.ts` — Teste E2E completo com TDD
- `accessibility_test.ts` — Auditoria automatizada com axe-core

**Helper Scripts em `scripts/`:**
- `with_server.py` — Gerenciar ciclo de vida do servidor (legado — prefira `webServer` no config)
- `--help` sempre disponível para ver uso específico

---

*Skill versão 2026.05 | Atualizada com Playwright best practices 2026, web-first assertions, locator hierarchy oficial (getByRole > getByLabel > getByTestId), CI sharding, fixtures de autenticação via API, trace on-first-retry, integração com axe-core para a11y.*
