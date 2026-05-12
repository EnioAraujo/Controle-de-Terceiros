# Plano de Revitalização da Saúde do App — Controle de Terceiros

> **Persistência do plano:** ao aprovar e sair de plan mode, este arquivo deve ser copiado para
> [arquivolocal/arquivos_obrigatorios/PLANO_REVITALIZACAO_SAUDE.md](arquivolocal/arquivos_obrigatorios/PLANO_REVITALIZACAO_SAUDE.md)
> como artefato versionado no repositório (solicitado pelo usuário em 2026-05-12).
> Plan mode não permite escrita fora do arquivo de plano — a cópia é a primeira ação pós-aprovação.

## Context

O repositório está em estado parcialmente saudável: refatoração de 2026-04 reduziu o monolito `Index.tsx` a 191 linhas, MFA com backup codes funciona, RLS está restritivo. Porém, com base nos arquivos obrigatórios (`AI_RULES.md`, `CONTEXT.md`, `DESIGN.md`, `skill_tdd.md`, `skill_seguranca-webapp.md`) e na auditoria realizada, persistem desvios que violam regras explícitas do projeto:

1. **2 testes vermelhos** em [MobileLancamentosPage.test.tsx](src/pages/MobileLancamentosPage.test.tsx) desde commit `a848692` ([TEST-FAILURES.md](TEST-FAILURES.md)) — viola AI_RULES §"Nunca commitar com testes falhando".
2. **Working tree dirty** com 3 arquivos modificados + 1 migration untracked (`fix_audit_log_aal1_auth_events.sql`) que corrige gap real de RLS em eventos MFA pré-AAL2.
3. **Monolitos remanescentes** que ferem o limite de ~200 linhas / responsabilidade única: [AdminPage.tsx](src/pages/AdminPage.tsx) (1070L) e [MobileLancamentosPage.tsx](src/pages/MobileLancamentosPage.tsx) (975L).
4. **Estilo inline com hex hardcoded** abundante nos top 4 (Mobile 86, Lancamentos 61, Projecao 52, Admin 48) — fere DESIGN.md "No-Line Rule" e Tonal Layering. (Tipografia postergada por decisão do usuário.)
5. CONTEXT.md §13 (dívida técnica) está desatualizado vs. o estado real do código.

**Resultado esperado:** árvore limpa, suíte 100% verde, monolitos divididos em componentes isolados ≤200L, estilo concentrado em tokens utilitários, CONTEXT.md fiel ao código, e migration MFA aplicada com auditoria. **Tipografia (DM Sans vs DESIGN.md) fica fora deste ciclo.**

---

## Etapas (escopo independente — cada uma é uma PR)

### Etapa 1 — Sanear working tree (PR1)
**Objetivo:** zerar o `git status`, validar que as mudanças pendentes do usuário fazem sentido.

- Ler e revisar as 3 modificações pendentes: [src/components/FechamentoTab.tsx](src/components/FechamentoTab.tsx), [src/pages/MfaSetupPage.tsx](src/pages/MfaSetupPage.tsx), [src/pages/MobileLancamentosPage.test.tsx](src/pages/MobileLancamentosPage.test.tsx).
- Ler [supabase/migrations/fix_audit_log_aal1_auth_events.sql](supabase/migrations/fix_audit_log_aal1_auth_events.sql) e validar: idempotência (IF NOT EXISTS / DROP POLICY IF EXISTS), restrição a eventos auth (`LOGIN_*`, `MFA_*`, `BACKUP_CODE_USED`), e que **não enfraquece** a policy AAL2 existente.
- Commit em granularidade conforme Conventional Commits (1 commit para o fix da migration, 1 para cada arquivo `.tsx` se forem mudanças independentes).

**Modificar:** os 3 arquivos acima (apenas se a revisão indicar que precisam de ajuste).
**Criar:** nada.
**Não tocar:** schema base ([supabase/schema/schema.sql](supabase/schema/schema.sql)).

---

### Etapa 2 — Corrigir os 2 testes vermelhos (PR2)
**Objetivo:** suíte vitest 100% verde antes de qualquer refactor.

- Em [src/pages/MobileLancamentosPage.test.tsx](src/pages/MobileLancamentosPage.test.tsx):
  - Trocar `getByText("Controle de")` → `getByAltText("Controle de Terceiros")` (branding já é `<img alt="...">` em [MobileLancamentosPage.tsx](src/pages/MobileLancamentosPage.tsx) ao redor da linha 618 — confirmado no inventário).
  - Para `getByText("Mobile")`: o badge foi removido. Duas opções aceitáveis — recomendo **remover o teste** (sintoma de teste preso a UI volátil sem valor) ou substituí-lo por verificação de que a barra de navegação mobile com tabs está visível via `getByRole('tablist')` ou `getByRole('button', { name: ... })`.
- Locators seguindo hierarquia da [skill_tdd.md](arquivolocal/arquivos_obrigatorios/skill_tdd.md) §3 (getByRole > getByLabel > getByAltText > getByText).
- Deletar [TEST-FAILURES.md](TEST-FAILURES.md) após confirmar `pnpm test` verde.

**Modificar:** `src/pages/MobileLancamentosPage.test.tsx`.
**Criar:** nada.
**Não tocar:** `MobileLancamentosPage.tsx` (lógica intacta).
**Remover:** `TEST-FAILURES.md`.

---

### Etapa 3 — Atualizar CONTEXT.md §13 (PR3)
**Objetivo:** alinhar documentação ao código real (regra AI_RULES §"Ler arquivo inteiro antes de editar" depende de docs corretos).

- Marcar **resolvidos** na tabela §13: Index monolítico, syncList, BlockHeader, fmtMes, Btn outline.
- **Reverter** entrada "QueryClientProvider sem uso" — inventário confirmou uso real em [AdminPage.tsx](src/pages/AdminPage.tsx), [AdminFornecedoresTab.tsx](src/components/admin/AdminFornecedoresTab.tsx), [AtribuirFornecedorList.tsx](src/components/admin/AtribuirFornecedorList.tsx).
- **Adicionar** novos itens: (a) AdminPage 1070L; (b) MobileLancamentosPage 975L; (c) inline-hex/style nos top 4; (d) tipografia DM Sans vs DESIGN.md (postergada — registrar como decisão).
- Anexar linha em §14 (histórico) datada 2026-05-12 descrevendo o ciclo de revitalização.

**Modificar:** [arquivolocal/arquivos_obrigatorios/CONTEXT.md](arquivolocal/arquivos_obrigatorios/CONTEXT.md).
**Criar:** nada.

---

### Etapa 4 — Dividir [AdminPage.tsx](src/pages/AdminPage.tsx) (1070L → orquestrador ≤150L) (PR4)
**Objetivo:** responsabilidade única; tabs viram componentes isolados; queries/mutations em hook.

**Criar:**
- `src/components/admin/AdminUsuariosTab.tsx` — Stats + Grid/Lista + AlertDialogs (criar/excluir/reset).
- `src/components/admin/AdminPermissoesTab.tsx` — coluna usuários + presets + Accordion de permissões.
- `src/components/admin/AdminContaTab.tsx` — alterar senha + enrollment/unenrollment MFA.
- `src/hooks/useAdminUsers.ts` — agrupa `useQuery(profiles)`, `approvalMutation`, `roleMutation`, `permsMutation`, `unblockMutation`, `callAdminFn` (chamada à serverless `/api/admin-users`).

**Modificar:**
- [src/pages/AdminPage.tsx](src/pages/AdminPage.tsx) — vira orquestrador: monta `<Tabs>` shadcn e renderiza as 3 abas + a `AdminFornecedoresTab` existente. Mantém guards de admin e header.

**Não tocar:**
- [src/components/admin/AdminFornecedoresTab.tsx](src/components/admin/AdminFornecedoresTab.tsx) (já isolada, 1 query + 1 useQueryClient).
- [src/components/admin/AtribuirFornecedorList.tsx](src/components/admin/AtribuirFornecedorList.tsx).
- [api/admin-users.ts](api/admin-users.ts) (Serverless Function — fora de escopo).
- `src/components/ui/**` (shadcn).

**Reutilizar:** `logAudit` de [src/lib/audit.ts](src/lib/audit.ts), `mapSupabaseError` de [src/lib/i18n-translations.ts](src/lib/i18n-translations.ts), `useI18n`.

---

### Etapa 5 — Dividir [MobileLancamentosPage.tsx](src/pages/MobileLancamentosPage.tsx) (975L → orquestrador ≤200L) (PR5)
**Objetivo:** mesmas regras da Etapa 4. Resolve simultaneamente o item "inline-hex 86 ocorrências".

**Criar:**
- `src/components/mobile/MobileTopBar.tsx` — header fixo + sair + tabs scroll.
- `src/components/mobile/MobileFiltros.tsx` — filtros colapsáveis (data, mês, período, fornecedor).
- `src/components/mobile/MobileLancamentoCard.tsx` — card individual de registro/lote.
- `src/components/mobile/MobileFab.tsx` — botão flutuante de novo lançamento.
- `src/components/mobile/MobileBottomSheet.tsx` — Editar / Excluir / WhatsApp.
- `src/hooks/useMobileLancamentos.ts` — estado de seleção em massa, filtros, agrupamento por data+turno.

**Modificar:**
- [src/pages/MobileLancamentosPage.tsx](src/pages/MobileLancamentosPage.tsx) — orquestrador que monta os 5 componentes acima.

**Não tocar:**
- [src/components/FormLancamento.tsx](src/components/FormLancamento.tsx) — reutilizado intacto.
- [src/hooks/useStorage.ts](src/hooks/useStorage.ts).
- CSS mobile em [src/globals.css](src/globals.css) (apenas mover, não reescrever).

**Reutilizar:** `buildWhatsAppMessage` de [src/lib/format-utils.ts](src/lib/format-utils.ts), `FormLancamento`, `useOpcoes`.

---

### Etapa 6 — Reduzir inline-hex em [Lancamentos.tsx](src/components/Lancamentos.tsx) e [ProjecaoPage.tsx](src/pages/ProjecaoPage.tsx) (PR6)
**Objetivo:** consolidar paleta sem alterar tipografia. Atacar os 2 maiores ofensores restantes após Etapas 4 e 5.

**Criar:**
- `src/lib/design-tokens.ts` — exporta constantes (`SURFACE`, `SURFACE_CONTAINER_LOW`, `PRIMARY`, `ON_SURFACE`, etc.) com os hex já em uso no app, alinhadas semanticamente ao DESIGN.md §2 (mas sem renomear fonts).
- Classes utilitárias em [src/globals.css](src/globals.css) para os 4 padrões mais repetidos (page-surface, section-block, lifted-card, ghost-border).

**Modificar:**
- [src/components/Lancamentos.tsx](src/components/Lancamentos.tsx) — substituir hex inline por classes/tokens.
- [src/pages/ProjecaoPage.tsx](src/pages/ProjecaoPage.tsx) — idem.

**Não tocar:**
- Lógica de filtros/cálculo; apenas o `style={{}}`.
- Componentes shadcn.

> Critério de aceite: ocorrências de `#` em cada arquivo caem para <10.

---

### Etapa 7 — Hardening leve + auditoria (PR7)
**Objetivo:** validar que regras do [skill_seguranca-webapp.md](arquivolocal/arquivos_obrigatorios/skill_seguranca-webapp.md) seguem aplicadas após o refactor.

- Rodar `pnpm audit --audit-level=high` e registrar achados (sem upgrade automático — AI_RULES proíbe update sem revisão de segurança).
- Grep validando `logAudit(` em todo INSERT/UPDATE/DELETE/PURGE de [useStorage.ts](src/hooks/useStorage.ts), [useOpcoes.ts](src/hooks/useOpcoes.ts), [useAdminUsers.ts](src/hooks/useAdminUsers.ts) novo.
- Confirmar headers HSTS + CSP em [vercel.json](vercel.json) (sem alteração se já corretos).
- Confirmar zero `as any` em `src/` (inventário já confirma — manter).

**Modificar:** nada por padrão (apenas se a auditoria apontar algo).
**Criar:** `arquivolocal/AUDIT-2026-05.md` com resumo dos achados.

---

### Etapa 8 — Smoke tests para páginas críticas (PR8)
**Objetivo:** rede de segurança seguindo [skill_tdd.md](arquivolocal/arquivos_obrigatorios/skill_tdd.md) §2.

**Criar:**
- `src/pages/AdminPage.test.tsx` — smoke: renderiza para admin / bloqueia para não-admin (mock `is_admin` RPC).
- `src/pages/LoginPage.test.tsx` — smoke: fluxo `step=login` → `step=mfa` quando o user tem fator verificado.

**Modificar:** nada.
**Não tocar:** testes já existentes em `src/**/*.test.ts`.

> Locators: getByRole > getByLabel > getByAltText. **Proibido** getByText em texto volátil.

---

## Arquivos a NÃO tocar em todo o ciclo
- `src/components/ui/**` (shadcn — regra AI_RULES).
- `supabase/schema/schema.sql` (schema base).
- `arquivolocal/arquivos_obrigatorios/AI_RULES.md`, `DESIGN.md`, `skill_tdd.md`, `skill_seguranca-webapp.md`, `TOTP_MELHORES_PRATICAS.md`, `skill-webapp-testing.md`.
- `api/admin-users.ts` (serverless — sem necessidade neste ciclo).
- `public/**` (assets).
- `src/lib/i18n-translations.ts` (1076L mas é mapeamento puro — não é dívida).
- Toda a stack de tipografia (DM Sans/Mono → postergada).

---

## Verificação end-to-end (rodar após cada PR e ao final)

```bash
pnpm test                    # vitest run — todos verdes
npx tsc --noEmit             # zero erros TS (AI_RULES §3)
pnpm build                   # esbuild/Vite strict (AI_RULES §4)
pnpm audit --audit-level=high
pnpm dev                     # smoke manual:
                             #  - /login (com MFA)
                             #  - /admin (3 tabs)
                             #  - /mobile (filtros, FAB, bottom sheet, WhatsApp)
                             #  - /fechamento (multi-fornecedor)
```

**Validação adicional após Etapa 1 (migration MFA):** aplicar `fix_audit_log_aal1_auth_events.sql` em projeto Supabase staging e validar que (a) eventos `LOGIN_SUCCESS`, `MFA_VERIFY`, `MFA_VERIFY_FAIL`, `BACKUP_CODE_USED` chegam ao `audit_log` em sessões AAL1, (b) policies AAL2 existentes seguem bloqueando inserts não-auth.

---

## Estimativa

| PR | Arquivos criar | Arquivos modificar | Arquivos remover |
|---|---|---|---|
| 1 | 0 | 3 | 0 |
| 2 | 0 | 1 | 1 (TEST-FAILURES.md) |
| 3 | 0 | 1 | 0 |
| 4 | 4 | 1 | 0 |
| 5 | 6 | 1 | 0 |
| 6 | 1 (+CSS) | 3 | 0 |
| 7 | 1 | 0 | 0 |
| 8 | 2 | 0 | 0 |
| **Total** | **14** | **10** | **1** |

**~25 arquivos impactados** em 8 PRs independentes.

---

## Riscos e dependências críticas

1. **Migration MFA (PR1)** — se aplicada errada, pode bloquear login em produção. **Mitigação:** aplicar em staging primeiro; manter rollback (`DROP POLICY`) pronto; revisar com `pnpm test` da camada de auth.
2. **Refactor AdminPage (PR4)** — quebra silenciosa em RBAC/aprovação se as mutations forem reescritas. **Mitigação:** Etapa 8 (smoke test admin) deve preceder o merge OU executar testes manuais cobrindo: criar usuário, aprovar, mudar role, reset senha, excluir.
3. **Refactor MobileLancamentosPage (PR5)** — pode invalidar cache PWA (Workbox). **Mitigação:** rodar `pnpm build` + testar PWA em `pnpm preview` antes de merge.
4. **Tipografia postergada** — cria uma dívida explícita registrada em CONTEXT §13; **não bloqueia** este ciclo mas precisa ser endereçada em ciclo separado para alinhar código ao DESIGN.md.
5. **Ordem entre PRs**: PR1 → PR2 → PR3 podem ir em paralelo. PR4–PR6 dependem de PR2 (testes verdes). PR7 e PR8 só após todos os refactors.
6. **Regra AI_RULES** "Não atualizar dependências sem verificar segurança" continua aplicada — PR7 só **reporta** vulnerabilidades, não atualiza.
