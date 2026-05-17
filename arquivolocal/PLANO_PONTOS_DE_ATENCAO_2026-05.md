# Plano — Resolução dos Pontos de Atenção Pós-Crystalline-Locket

## Context

A auditoria de fechamento do ciclo "crystalline-locket" (2026-05-17, registrada em [AUDIT-2026-05.md](AUDIT-2026-05.md)) identificou 4 pontos de atenção não resolvidos:

1. **Branch divergida** — `Main-terceiros` 11 commits à frente, 1 atrás de `origin/Main-terceiros`
2. **`Lancamentos.tsx` em 551L** — leaf component acima do alvo
3. **CVE residual yaml < 2.8.3** — transitiva de build-time
4. **Dívida postergada (CONTEXT.md §13):** DM Sans, GuidedTour, cobertura e2e

A investigação revelou inconsistências entre a auditoria e o estado real:

- **DM Sans é conflito de design.** `globals.css` declara Space Grotesk + Plus Jakarta Sans + Inter (DESIGN.md), mas 12 arquivos usam `fontFamily:"'DM Sans'..."` inline e LoginPage usa classe `font-dm-sans` não declarada no Tailwind. **Decisão:** consolidar em Space Grotesk/PJS/Inter.
- **GuidedTour não é "JSX legacy".** `src/components/GuidedTour.tsx` (217L) já é TypeScript moderno. Backup `.jsx` em `arquivolocal/` é morto. Componente não usado em nenhuma página. **Decisão:** integrar + remover backup.
- **E2E já tem cobertura.** Specs `login`, `mfa`, `main-page` cobrem ~70 casos. Entrada de dívida desatualizada — apenas atualizar docs.

Outcome: branch sincronizada, yaml patcheado, tipografia padronizada, GuidedTour ativado, `Lancamentos.tsx` <250L, docs corrigidos.

---

## Etapas

### Etapa 1 — Sincronizar branch com origin

**Ação:**
1. `git fetch origin`
2. `git show 142a319 --stat` — confirmar impacto baixo
3. `git branch backup-pre-rebase` — backup
4. `git rebase origin/Main-terceiros`
5. `pnpm tsc --noEmit && pnpm test` revalidar
6. **Pedir autorização** antes de `git push --force-with-lease origin Main-terceiros`

**Fallback:** Se rebase complexo, `git merge origin/Main-terceiros`.

### Etapa 2 — Patch yaml CVE

**Modificar:** `package.json` — adicionar em `"pnpm": { "overrides": ... }`:
```json
"yaml@<2.8.3": ">=2.8.3"
```

**Comandos:** `pnpm install --force && pnpm audit --prod && pnpm build && pnpm test`

**Atualizar:** [AUDIT-2026-05.md](AUDIT-2026-05.md) §1.

### Etapa 3 — Atualizar docs sobre e2e

**Estado real:** `tests/e2e/{login,main-page,mfa}.spec.ts` + `helpers.ts` cobrem ~70 casos.

**Modificar:**
- `arquivolocal/arquivos_obrigatorios/CONTEXT.md` §13 — remover linha "Sem cobertura e2e"; entrada §14 datada.
- `arquivolocal/AUDIT-2026-05.md` §5 — atualizar para mencionar suítes existentes; "expandir cobertura" em vez de "criar do zero".

### Etapa 4 — Padronização tipográfica

**Estado atual:**
- `globals.css:46-49`: vars Space Grotesk / Plus Jakarta Sans / Inter
- 12 arquivos com inline DM Sans
- LoginPage: classe `font-dm-sans` (inexistente)
- AdminPage: `<style>@import url('...DM+Sans...')</style>`

**Modificar:**

1. **`index.html`** — `<link>` Google Fonts (preconnect + Space Grotesk + Plus Jakarta Sans + Inter)
2. **`tailwind.config.ts`** — `fontFamily: { display, body, label }` apontando para `var(--font-*)`
3. **`src/pages/AdminPage.tsx`** — remover `<style>@import...DM+Sans...</style>` + inline
4. **`src/pages/LoginPage.tsx`** — remover `font-dm-sans` (substituir por `font-body`/`font-display`)
5. **Demais arquivos com inline DM Sans:** App.tsx, ResetPasswordPage, MfaSetupPage, FornecedorMobilePage, FornecedorPage, ResumoAcumuladoPage, FornecedorShell — remover `fontFamily:"'DM Sans'..."` (herda de body)

**Verificação:** DevTools mostra `font-family: 'Plus Jakarta Sans'` em body.

### Etapa 5 — GuidedTour integração (após Etapa 6)

**Criar:**
- `src/lib/tour-steps.ts` (~80L) — `TOUR_STEPS_LANCAMENTOS` com 4 steps usando ids `tour-btn-novo`, `tour-filtros`, `tour-tabela`, `tour-btn-export` (já existem em Lancamentos.tsx)
- `src/components/TourButton.tsx` (~40L) — botão "?" no header

**Modificar:**
- `src/pages/Index.tsx` — wire TourButton no header
- `src/lib/i18n-translations.ts` — chaves PT/EN

**Deletar:** `arquivolocal/GuidedTour.jsx`

**Atualizar:** CONTEXT.md §13 — remover "GuidedTour.jsx em JSX legacy".

### Etapa 6 — Dividir `Lancamentos.tsx` (cobre csvSafe)

**Anotação:** Substitui Etapa 1 do [PLANO_TESTES_ADVERSARIAIS.md](PLANO_TESTES_ADVERSARIAIS.md).

**Criar:**
| Arquivo | Linhas est. |
|---------|-------------|
| `src/lib/csv-export.ts` | ~25 |
| `src/hooks/useLancamentos.ts` | ~140 |
| `src/components/lancamentos/LancamentosTable.tsx` | ~120 |
| `src/components/lancamentos/LancamentosDetailModal.tsx` | ~90 |
| `src/components/lancamentos/LancamentosConflictModal.tsx` | ~70 |

**Modificar:**
- `src/components/Lancamentos.tsx` (551L → ~220L) — orquestrador
- `arquivolocal/PLANO_TESTES_ADVERSARIAIS.md` — anotar Etapa 1 obsoleta
- `arquivolocal/arquivos_obrigatorios/CONTEXT.md` §13 — remover "Lancamentos.tsx 551L"

**Sub-commits:** csvSafe → hook → cada componente isolado.

---

## NÃO tocar

- `src/lib/audit.ts`, `format-utils.ts`, demais utils
- `src/components/GuidedTour.tsx`, `src/hooks/use-tour.ts` (já maduros)
- `supabase/migrations/*`
- `playwright.config.ts`, `vite.config.ts`
- Specs e2e existentes
- Testes Vitest existentes
- Componentes externos consumidos por Lancamentos (`FormLancamento`, etc.)

---

## Ordem de Execução

1 → 2 → 3 → 4 → 6 → 5

(Etapa 6 antes da 5 para garantir que ids dos tour-steps estão consolidados nos componentes finais.)

---

## Verificação por etapa

- **Etapa 1:** `git status` "up to date with origin"
- **Etapa 2:** `pnpm audit --prod` zero vulnerabilidades
- **Etapa 3:** `grep -c "Sem cobertura e2e" CONTEXT.md` == 0
- **Etapa 4:** DevTools `font-family: 'Plus Jakarta Sans'` no body
- **Etapa 5:** Click "?" abre tour com 4 steps
- **Etapa 6:** `wc -l src/components/Lancamentos.tsx` < 250

A cada etapa: `pnpm tsc --noEmit && pnpm test` verde.

---

## Riscos

1. **Branch push:** autorização explícita necessária
2. **yaml override:** `pnpm build` é gate
3. **DM Sans removal:** risco visual médio; testar Login/Admin/Lançamentos manualmente
4. **GuidedTour ids:** após Etapa 6 (split), validar que `tour-btn-novo`, `tour-filtros`, `tour-tabela`, `tour-btn-export` preservados nos sub-componentes
5. **Etapa 6 refactor:** maior risco; commits incrementais
6. **Conflito com PLANO_TESTES_ADVERSARIAIS:** resolvido (Etapa 6 cobre csvSafe)

---

## Estimativa

- **Criar:** 7 arquivos
- **Modificar:** ~16 arquivos
- **Deletar:** 1 (GuidedTour.jsx backup)
- **CVE resolvidas:** 1
- **Dívida resolvida:** 3 itens (Lancamentos size, DM Sans, GuidedTour)
- **Docs corrigidos:** 1 (e2e desatualizado)
