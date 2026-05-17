# Plano — Bateria de Testes Adversariais (Red-Team)

> **Status 2026-05-17:** Etapa 1 (extração de `csvSafe` para `src/lib/csv-export.ts`) foi **coberta pelo PLANO_PONTOS_DE_ATENCAO_2026-05 Etapa 6** (commit c6d9993). Pular Etapa 1 abaixo; demais etapas (Camadas A/B/C) seguem pendentes.

## Context

A base atual tem 233 testes em 21 suítes, mas todos cobrem **caminho feliz** — escritos pela mesma pessoa que implementou o código, dando vantagem ao defensor. Este plano cria testes "estilo invasão", simulando atacante usando devtools do navegador (manipulação de localStorage/sessionStorage, JWT tampering, payloads OWASP).

App está em desenvolvimento, sem staging dedicado. Aplicação usa:
- Supabase Auth + RLS para autorização (`is_admin` RPC, `check_user_blocked`, `record_failed_login`)
- DOMPurify (`src/lib/audit.ts:6`) para sanitização de entrada
- `csvSafe` (`src/components/Lancamentos.tsx:191`) para escape de fórmulas em export CSV
- MFA TOTP com replay guard (`MFA_REPLAY_KEY` em sessionStorage, TTL 35s)
- 16 chamadas a `logAudit` cobrindo INSERT/UPDATE/DELETE/PURGE/MFA/LOGIN events

Vulnerabilidades pré-identificadas (a confirmar via teste):
- `PrivacyNotice.tsx:45,50` chama `DOMPurify.sanitize(t(...))` **sem** `ALLOWED_TAGS:[]` — permite ~60 tags se i18n for poluído
- `csvSafe` não escapa **backtick** em campos com aspas
- JWT `aal` claim lido client-side sem verificar assinatura (mas só pra UX, não é authority)
- `deviceMode` em sessionStorage pode ser definido sem auth — afeta roteamento

Decisões aprovadas:
1. **Testes passam, achados documentados** — suite verde, vulnerabilidades em `SECURITY-FINDINGS-2026-05.md`
2. **Camada C** = esqueletos skipped + script de seeding SQL (ativar quando tiver staging)
3. **Localização Vitest** = co-located com sufixo `.security.test.ts`

Outcome esperado: 3 camadas de testes adversariais rodando localmente sem infra adicional, mais ~6 specs skipped prontos para staging, mais documento de achados verificados.

---

## Arquitetura — 3 Camadas

```
Camada A (Vitest fuzz, sem infra)              ─→ funções puras + componentes isolados
  src/lib/audit.security.test.ts                  sanitize() com 35+ payloads XSS
  src/lib/csv-injection.security.test.ts          csvSafe extraído + 14 payloads
  src/components/PrivacyNotice.security.test.tsx  validação i18n poisoning

Camada B (Playwright client-side, mocks Supabase) ─→ browser real, sem backend
  tests/e2e/security/payloads.ts                  biblioteca compartilhada
  tests/e2e/security/helpers.ts                   JWT/storage tampering utils
  tests/e2e/security/01-jwt-tampering.spec.ts
  tests/e2e/security/02-storage-tampering.spec.ts
  tests/e2e/security/03-route-bypass.spec.ts
  tests/e2e/security/04-mfa-replay.spec.ts
  tests/e2e/security/05-xss-rendered.spec.ts
  tests/e2e/security/06-csv-export-injection.spec.ts

Camada C (Playwright real-Supabase, skipped)      ─→ pronto para staging
  tests/e2e/security/real-supabase/README.md
  tests/e2e/security/real-supabase/seed.sql
  tests/e2e/security/real-supabase/helpers.ts
  tests/e2e/security/real-supabase/rls-bypass.spec.ts
  tests/e2e/security/real-supabase/privilege-escalation.spec.ts
  tests/e2e/security/real-supabase/idor.spec.ts
```

---

## Etapas (independentes, cada uma commitável isolada)

### Etapa 1 — Refatoração mínima de `csvSafe` (apenas extração, sem mudança comportamental)
**Objetivo:** Permitir testar `csvSafe` sem montar componente React inteiro.

**Criar:**
- `src/lib/csv-export.ts` (~25L) — exporta `csvSafe(val: string)` idêntica à atual

**Modificar:**
- `src/components/Lancamentos.tsx` — substituir definição inline por `import { csvSafe } from "@/lib/csv-export"`. Reduz `Lancamentos.tsx` de 551L → ~543L.

**NÃO tocar:** Lógica de exportCSV (continua em Lancamentos.tsx, só a função pura é extraída).

**Risco:** Nenhum se cópia é fiel. Tests existentes seguem verdes.

### Etapa 2 — Camada A: Vitest fuzz
**Criar:**
- `src/lib/audit.security.test.ts` (~180L) — testa `sanitize()`:
  - 15 payloads XSS clássicos (`<script>`, `<img onerror>`, `<svg onload>`, etc.)
  - 6 payloads de bypass (HTML entities, Unicode, null bytes, mutation XSS)
  - 4 payloads de DoS (strings 1MB, deep nesting, recursive entities)
  - 3 payloads `javascript:` URL (verificar que href é preservado mas tag <a> removida)
  - 4 assertion suites: "remove todas tags HTML", "preserva texto puro", "não trava em payload malicioso", "não retorna `undefined`"
  - Asserções por output esperado, não por comparação string exata (evita false-pass)

- `src/lib/csv-injection.security.test.ts` (~140L) — testa `csvSafe()`:
  - 14 payloads: `=cmd|'/c calc'!A1`, `=HYPERLINK`, `=IMPORTXML`, `+1+1`, `-MERGE`, `@SUM`, `\t=1+1`, payloads com `\r\n` embutido, backtick, prefixo com whitespace + `=`
  - Assertion: linha gerada **não pode** começar com `=`, `+`, `-`, `@`, `\t` quando descolada de aspas
  - Documenta a falha do backtick (caso confirmada) em comentário do teste E em FINDINGS

- `src/components/PrivacyNotice.security.test.tsx` (~80L) — verifica:
  - `t()` retornando `<script>alert(1)</script>` é renderizado sem executar
  - Renderização com `<img src=x onerror=...>` em i18n string
  - Asserção: `window` não tem propriedades poluídas; nenhum `<script>` no DOM

**Asserções "red team":** cada payload tem expected output explícito. Se `sanitize` mudar comportamento, teste falha (não tolerância silenciosa).

### Etapa 3 — Camada B: Helpers + Payloads
**Criar:**
- `tests/e2e/security/payloads.ts` (~120L) — biblioteca exportável:
  - `XSS_PAYLOADS: string[]`
  - `CSV_INJECTION_PAYLOADS: string[]`
  - `SQL_LOOKALIKE_PAYLOADS: string[]` (Supabase sanitiza, mas testar passagem por sanitize/inputs)
  - `PATH_TRAVERSAL_PAYLOADS: string[]`
  - `UNICODE_BYPASS_PAYLOADS: string[]`
  - `LONG_STRING_DOS: string` (1MB)

- `tests/e2e/security/helpers.ts` (~180L):
  - `tamperJwt(page, claims)` — decoda token base64 do localStorage, modifica claims (e.g., `aal: "aal2"`, `is_admin: true`), reencoda sem signature válida, salva
  - `setStorageBypass(page, { key, value, scope })` — manipula local/sessionStorage
  - `mockSupabaseAuth(page, opts)` — extends helpers.ts existente com cenários adversariais (sessão expirada, AAL1 sem MFA)
  - `interceptFetch(page, urlPattern, response)` — para mockar respostas adversariais
  - `getConsoleErrors(page)` — coleta erros para validar fail-closed

**Reutiliza:** `SUPABASE_URL` e `FAKE_SESSION` de `tests/e2e/helpers.ts` (não duplica).

### Etapa 4 — Camada B: Specs Playwright client-side
Cada spec é independente, ~100-150L:

- `01-jwt-tampering.spec.ts` — Tampera localStorage `sb-*-auth-token`:
  - Cenário 1: Adiciona `is_admin:true` no payload → confirma que `/admin` ainda exige `rpc('is_admin')` real
  - Cenário 2: Modifica `aal: "aal2"` sem MFA real → confirma que protected routes ainda redirecionam
  - Cenário 3: Token expirado mas `expires_at` adulterado → confirma logout

- `02-storage-tampering.spec.ts`:
  - `deviceMode` forjado pra `desktop` sem login → não bypassa autenticação
  - `mfa_replay_guard` apagado mid-session → reuso de código MFA detectado pelo backend (mock retornando erro)
  - `lgpd_aceito` removido → modal reaparece (UX, não security)
  - `totp_rate` zerado → não bypassa rate limit do backend
  - `i18n-lang` com payload XSS → tratamento seguro

- `03-route-bypass.spec.ts`:
  - GET `/admin` sem session → redirect `/`
  - GET `/admin` com session mas `is_admin:false` no RPC → redirect
  - GET `/admin` com session+admin mas `is_approved:false` → bloqueio
  - GET `/fornecedor/X` sem session → redirect
  - GET `/mfa-setup` sem auth → redirect
  - Open redirect: `?next=https://evil.com` → não navega externa

- `04-mfa-replay.spec.ts`:
  - Insere hash `mfa_replay_guard` válido + tenta verify novamente → bloqueado client-side
  - Hash com timestamp 30s atrás → ainda dentro de TTL, bloqueado
  - Hash com timestamp 36s atrás → permitido (TTL expirou)
  - Mock backend retornando sucesso, mas guard client bloqueia → confirmação

- `05-xss-rendered.spec.ts`:
  - Para cada payload em `XSS_PAYLOADS`: submete no campo `nome` do FormLancamento → renderiza → assert `page.on('dialog')` nunca foi chamado E `window.__xssPwned === undefined`
  - Testa em pelo menos 3 campos diferentes (nome, obs, motivo)

- `06-csv-export-injection.spec.ts`:
  - Inject `=cmd|'/c calc'!A1` via input
  - Trigger export CSV
  - Captura download via `page.waitForEvent('download')`
  - Lê conteúdo, assertions: nenhuma célula começa com `=|+|-|@|\t` desescapado

### Etapa 5 — Camada C: Esqueletos real-Supabase + Seed
**Criar:**
- `tests/e2e/security/real-supabase/README.md` (~80L):
  - Como configurar variáveis env (`SECURITY_E2E_SUPABASE_URL`, `SECURITY_E2E_ADMIN_KEY`)
  - Como rodar seed.sql no Supabase staging
  - Como rodar a suite: `SECURITY_E2E=1 pnpm test:e2e tests/e2e/security/real-supabase`
  - Aviso de risco: dados sacrificáveis, não rodar contra prod

- `tests/e2e/security/real-supabase/seed.sql` (~80L):
  - Cria 3 usuários: `pentest-admin@test.local`, `pentest-user@test.local`, `pentest-fornecedor@test.local`
  - Atribui roles, fornecedores
  - Insere ~5 registros sacrificáveis
  - Idempotente (`ON CONFLICT DO NOTHING`)

- `tests/e2e/security/real-supabase/helpers.ts` (~100L):
  - `loginReal(email, password)` — autentica via Supabase real
  - `getActiveSession()` — recupera token atual
  - `assertCannotAccess(table, op)` — tenta operação que RLS deve negar

- `tests/e2e/security/real-supabase/rls-bypass.spec.ts` (~100L, todos skipped):
  - User comum tentando `SELECT * FROM registros` sem filtro → deve retornar só dele
  - User fornecedor tentando ler registros de outro fornecedor
  - Tentativa de INSERT em `profiles` com `is_admin:true` → bloqueio RLS

- `tests/e2e/security/real-supabase/privilege-escalation.spec.ts` (~100L, todos skipped):
  - User comum tentando `rpc('approve_user')` direto
  - User comum tentando UPDATE em `profiles` próprio com `is_admin:true`
  - Tentativa de chamar `criar_fechamento` sem ser admin

- `tests/e2e/security/real-supabase/idor.spec.ts` (~80L, todos skipped):
  - Lista registros via UUIDs sequenciais (sweep)
  - Acesso direto a `audit_log` (deve ser admin-only)

Todos com `test.skip(!process.env.SECURITY_E2E, "Requer Supabase staging — ver README")` no topo.

### Etapa 6 — Documentação dos achados
**Criar:**
- `arquivolocal/SECURITY-FINDINGS-2026-05.md` (~200L):
  - Sumário executivo (severidades)
  - Por findigem: descrição, CVSS aproximado, passos de reprodução (com paste de payload), impacto, recomendação
  - Findings esperados (validar via teste antes de documentar):
    1. PrivacyNotice DOMPurify sem ALLOWED_TAGS — Severidade: Baixa (depende de i18n poisoning)
    2. csvSafe não cobre backtick — Severidade: Baixa-Média
    3. JWT client-side decode sem verify — Severidade: Informativa (não é authority)
    4. (qualquer outro descoberto durante implementação)
  - Seção "Validações que passaram" (anti-falsos-positivos)

### Etapa 7 — Scripts e finalização
**Modificar:**
- `package.json` — adicionar:
  - `"test:security": "vitest run --testPathPattern=\\.security\\."`
  - `"test:security:e2e": "playwright test tests/e2e/security"`
  - `"test:security:all": "pnpm test:security && pnpm test:security:e2e"`

**NÃO modificar:** `playwright.config.ts` (já pega `tests/e2e/**`).

---

## Arquivos a Criar (resumo)

| # | Arquivo | Linhas est. | Camada |
|---|---------|-------------|--------|
| 1 | `src/lib/csv-export.ts` | 25 | A |
| 2 | `src/lib/audit.security.test.ts` | 180 | A |
| 3 | `src/lib/csv-injection.security.test.ts` | 140 | A |
| 4 | `src/components/PrivacyNotice.security.test.tsx` | 80 | A |
| 5 | `tests/e2e/security/payloads.ts` | 120 | B |
| 6 | `tests/e2e/security/helpers.ts` | 180 | B |
| 7 | `tests/e2e/security/01-jwt-tampering.spec.ts` | 130 | B |
| 8 | `tests/e2e/security/02-storage-tampering.spec.ts` | 150 | B |
| 9 | `tests/e2e/security/03-route-bypass.spec.ts` | 140 | B |
| 10 | `tests/e2e/security/04-mfa-replay.spec.ts` | 110 | B |
| 11 | `tests/e2e/security/05-xss-rendered.spec.ts` | 130 | B |
| 12 | `tests/e2e/security/06-csv-export-injection.spec.ts` | 120 | B |
| 13 | `tests/e2e/security/real-supabase/README.md` | 80 | C |
| 14 | `tests/e2e/security/real-supabase/seed.sql` | 80 | C |
| 15 | `tests/e2e/security/real-supabase/helpers.ts` | 100 | C |
| 16 | `tests/e2e/security/real-supabase/rls-bypass.spec.ts` | 100 | C |
| 17 | `tests/e2e/security/real-supabase/privilege-escalation.spec.ts` | 100 | C |
| 18 | `tests/e2e/security/real-supabase/idor.spec.ts` | 80 | C |
| 19 | `arquivolocal/SECURITY-FINDINGS-2026-05.md` | 200 | Docs |

**Total: 19 arquivos, ~2245 linhas.** Todos os arquivos individuais < 200L (exceto FINDINGS, que é docs).

## Arquivos a Modificar

| Arquivo | Mudança | Risco |
|---------|---------|-------|
| `src/components/Lancamentos.tsx` | Substituir definição inline de `csvSafe` por `import` (≈8 linhas afetadas) | Baixo — função idêntica, testes existentes detectam regressão |
| `package.json` | +3 scripts | Nulo |

## Arquivos que NÃO devem ser tocados

- `src/lib/audit.ts` — sanitize() permanece intocado (testamos o comportamento atual; correção entra em outro ciclo)
- `src/components/PrivacyNotice.tsx` — vulnerabilidade reportada mas não corrigida nesta entrega
- `src/pages/LoginPage.tsx`, `MfaSetupPage.tsx`, `AdminPage.tsx`, etc. — produção intacta
- Todas as migrations em `supabase/migrations/`
- `playwright.config.ts` — já cobre `tests/e2e/**`
- `tests/e2e/{login,main-page,mfa,helpers}.{ts,spec.ts}` — testes existentes não tocados
- `src/test/setup.ts` — setup global intacto

## Verificação (smoke do entregável)

1. `pnpm tsc --noEmit` — limpo
2. `pnpm test` — 233 anteriores + ~80 novos casos Vitest todos verdes
3. `pnpm test:security` — só os adversariais Vitest, verde
4. `pnpm test:e2e tests/e2e/security` — Camada B verde; Camada C skipped (saída: "X tests skipped")
5. `grep -c "test.skip" tests/e2e/security/real-supabase/*.spec.ts` — confirma skip
6. `cat arquivolocal/SECURITY-FINDINGS-2026-05.md` — achados documentados com reprodução
7. Inspeção manual: `tests/e2e/security/06-csv-export-injection.spec.ts` valida que CSV exportado realmente bloqueia fórmulas (assertions explícitas)

## Riscos e Dependências Críticas

1. **Playwright webServer auto-start** — `playwright.config.ts` inicia `pnpm dev --port 5173`. Suite adversarial herda; primeira execução pode demorar 30s. **Mitigação:** documentar em README; permitir `reuseExistingServer`.

2. **Mocks Supabase realistas** — JWT tampering só "prova algo" se o mock de `/auth/v1/user` rejeitar token modificado quando assinatura é inválida. **Mitigação:** Camada B é frontend-focused; assertions são "client-side não eleva privilégio sozinho", não "backend valida JWT" (esse é Camada C).

3. **Findings documentados ≠ corrigidos** — `SECURITY-FINDINGS-2026-05.md` lista vulnerabilidades; correção fica para ciclo seguinte. Risco de esquecer. **Mitigação:** referenciar findings em CONTEXT.md §13 (dívida técnica).

4. **csvSafe extraction (Etapa 1)** — alteração mínima em arquivo de produção (Lancamentos.tsx). Risco de regressão. **Mitigação:** função copiada literal; testes vitest existentes (`format-utils.test.ts`, `import-registros-csv.test.ts`) e e2e detectam mudança comportamental.

5. **Estouro de timeout Playwright** — fuzz com loops longos podem estourar 30s default. **Mitigação:** payloads em arrays limitados (~15 por spec); usar `test.setTimeout()` quando necessário.

6. **Conflito com commits recentes** — últimos 6 commits foram refactor (AdminPage, MobileLancamentosPage, design-tokens) e smoke tests. Nenhum conflito direto; novos arquivos em pastas novas.

7. **Pre-commit hook** — projeto roda `pnpm test` pré-commit. Suite adversarial passa, mas adiciona ~30s ao tempo. **Aceitável** dado o ganho.

## Estimativa Final

- **Arquivos novos:** 19
- **Arquivos modificados:** 2 (Lancamentos.tsx + package.json)
- **Linhas adicionadas:** ~2245
- **Tempo de execução adicional:** ~30-60s pré-commit
- **Cobertura adversarial nova:** XSS, CSV injection, JWT tampering, storage tampering, route bypass, MFA replay, route guard fuzzing — 6 vetores client-side + 3 vetores backend (skipped)
