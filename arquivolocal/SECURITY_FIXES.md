# 🔐 Controle de Terceiros — Plano de Correções de Segurança

> **Gerado em:** 2026-04-17
> **Baseado em:** Auditoria do CONTEXT.md (branch `Main-terceiros`)
> **Prioridade:** Alta → Baixa

---

## 🔴 CRÍTICO — Corrigir antes do próximo deploy

### [FIX-01] `is_approved = true` como padrão — Acesso imediato sem aprovação

**Arquivo:** `supabase/schema.sql` + migration relevante
**Problema:** Qualquer pessoa que se cadastrar tem acesso imediato ao sistema. Um admin precisa bloquear *depois* — o inverso do esperado para um ambiente corporativo.

**Correção — alterar o DEFAULT na tabela `profiles`:**

```sql
-- ❌ Atual
is_approved BOOLEAN DEFAULT true

-- ✅ Corrigido
is_approved BOOLEAN DEFAULT false
```

**Criar migration `fix_default_is_approved.sql`:**

```sql
ALTER TABLE profiles ALTER COLUMN is_approved SET DEFAULT false;

-- Usuários existentes aprovados permanecem aprovados (não afeta dados já criados)
-- Apenas novos cadastros passam a exigir aprovação manual
```

**Impacto no frontend:** Verificar se `LoginPage` e `App.tsx` tratam o estado `is_approved = false` com mensagem clara para o usuário (ex: "Aguardando aprovação do administrador").

---

### [FIX-02] Route guard declarativo para `/admin` — Proteção no router

**Arquivo:** `src/App.tsx`
**Problema:** A proteção de `/admin` está na lógica interna do componente `AdminPage`. Se o perfil demorar a carregar (timeout Supabase, fluxo assíncrono), a tela pode renderizar sem verificar o role.

**Correção — criar componente `AdminRoute` e usá-lo no router:**

```tsx
// src/components/AdminRoute.tsx
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data, error }) => {
      if (error || !data) setStatus("denied");
      else setStatus("allowed");
    });
  }, []);

  if (status === "loading") return <div>Verificando permissões...</div>;
  if (status === "denied") return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

**Aplicar no `App.tsx`:**

```tsx
// ❌ Atual
<Route path="/admin" element={<AdminPage />} />

// ✅ Corrigido
import { AdminRoute } from "@/components/AdminRoute";

<Route path="/admin" element={
  <AdminRoute>
    <AdminPage />
  </AdminRoute>
} />
```

---

## 🟠 ALTO — Corrigir na próxima sprint

### [FIX-03] Purga LGPD client-side — Mover para server-side

**Arquivo:** `src/hooks/useStorage.ts`
**Problema:** A remoção de registros com `data < hoje - 5 anos` só ocorre quando o usuário abre o app. Se ninguém logar por semanas, dados expirados permanecem no banco — violação potencial da política de retenção LGPD.

**Correção — criar pg_cron job no Supabase:**

```sql
-- Migration: retention_cron.sql
-- Requer extensão pg_cron habilitada no projeto Supabase (Dashboard → Extensions)

SELECT cron.schedule(
  'purga-lgpd-anual',          -- nome do job
  '0 3 1 * *',                 -- todo dia 1º do mês às 03h
  $$
    DELETE FROM registros
    WHERE data < (CURRENT_DATE - INTERVAL '5 years');

    INSERT INTO audit_log (tabela, operacao, detalhes, created_at)
    VALUES (
      'registros',
      'PURGE',
      jsonb_build_object('motivo', 'Retenção LGPD 5 anos', 'executado_em', now()),
      now()
    );
  $$
);
```

**Atenção:** Manter a purga client-side em `useStorage.ts` como camada secundária — não remover, apenas não depender exclusivamente dela.

---

### [FIX-04] Triagem das 18 vulnerabilidades de dependência pendentes

**Arquivo:** `package.json`
**Problema:** O changelog registra redução de 26→18 CVEs, mas as 18 restantes não foram triadas publicamente no CONTEXT.md.

**Ação no terminal do projeto:**

```bash
pnpm audit --json > audit_report.json
```

**Critério de priorização:**

| Severidade | Ação |
|---|---|
| `critical` | Atualizar ou substituir imediatamente |
| `high` | Avaliar exploitabilidade no contexto do app; corrigir na sprint |
| `moderate` | Agendar para próxima atualização de deps |
| `low` | Monitorar |

**Dependências com histórico de CVE neste projeto (já tratadas, verificar se houve regressão):**

- `xlsx` → substituído por `exceljs` ✅ (confirmar que xlsx foi removido do `package.json`)
- `jspdf` → atualizado para 4.2.1 ✅
- `react-router-dom` → atualizado para 6.30.1 ✅
- `vite` → atualizado para 6.3.6 ✅

```bash
# Verificar se xlsx ainda está instalado (não deve estar)
cat package.json | grep xlsx
```

---

## 🟡 MÉDIO — Melhorias de hardening recomendadas

### [FIX-05] Mensagem de estado para usuários não aprovados

**Arquivo:** `src/pages/LoginPage.tsx` + `src/App.tsx`
**Problema:** Com `is_approved = false` como novo padrão (FIX-01), usuários recém-cadastrados precisam ver uma mensagem clara ao invés de um redirect silencioso ou tela em branco.

**Correção sugerida em `App.tsx` (na verificação de sessão):**

```tsx
// Após autenticação, verificar is_approved antes de redirecionar
const { data: profile } = await supabase
  .from("profiles")
  .select("is_approved, is_admin")
  .eq("id", session.user.id)
  .single();

if (!profile?.is_approved) {
  await supabase.auth.signOut();
  navigate("/login?status=pending_approval");
  return;
}
```

**Em `LoginPage.tsx`, exibir aviso quando `?status=pending_approval`:**

```tsx
const params = new URLSearchParams(location.search);
const isPending = params.get("status") === "pending_approval";

{isPending && (
  <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-3 rounded">
    Sua conta aguarda aprovação de um administrador.
  </div>
)}
```

---

### [FIX-06] Proteção adicional na Vercel API Route `/api/admin-users`

**Arquivo:** `api/admin-users.ts`
**Problema:** A rota já autentica via `auth.getUser()`, mas não valida explicitamente se o usuário autenticado é admin antes de executar ações privilegiadas.

**Verificação a adicionar (dupla validação server-side):**

```typescript
// api/admin-users.ts — após auth.getUser()
const { data: profile } = await supabase
  .from("profiles")
  .select("is_admin")
  .eq("id", user.id)
  .single();

if (!profile?.is_admin) {
  return res.status(403).json({ error: "Forbidden" });
}
```

> ⚠️ RLS protege o banco, mas a API Route usa `SUPABASE_SERVICE_ROLE_KEY` que **bypassa RLS**. A verificação de admin deve ser manual nesse contexto.

---

### [FIX-07] Validação de senha na criação de usuários

**Arquivo:** `api/admin-users.ts`
**Problema:** O changelog menciona validação de formato de email, mas não há registro de validação de força de senha na criação via painel admin.

**Adicionar validação antes do `auth.admin.createUser()`:**

```typescript
function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

if (!isStrongPassword(password)) {
  return res.status(400).json({
    error: "Senha fraca. Mínimo: 8 caracteres, 1 maiúscula, 1 número, 1 símbolo."
  });
}
```

---

## 📋 Checklist de verificação pós-correção

```
[ ] FIX-01 — DEFAULT is_approved alterado para false
[ ] FIX-01 — Frontend exibe mensagem adequada para usuários pendentes (ver FIX-05)
[ ] FIX-02 — AdminRoute criado e aplicado no App.tsx
[ ] FIX-03 — pg_cron configurado no Supabase Dashboard
[ ] FIX-03 — Migration retention_cron.sql aplicada
[ ] FIX-04 — pnpm audit executado e CVEs críticas/altas resolvidas
[ ] FIX-04 — Confirmado que `xlsx` foi removido do package.json
[ ] FIX-05 — LoginPage trata ?status=pending_approval
[ ] FIX-06 — api/admin-users.ts valida is_admin server-side
[ ] FIX-07 — Validação de força de senha adicionada
[ ] Todos os testes passando: pnpm test
[ ] pnpm audit sem itens critical ou high
```

---

## 📌 Referências

| Item | Referência |
|---|---|
| OWASP A01 — Broken Access Control | [owasp.org/Top10/A01](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) |
| OWASP A07 — Auth Failures | [owasp.org/Top10/A07](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/) |
| LGPD Art. 46 — Segurança | Lei 13.709/2018 |
| Supabase pg_cron | [supabase.com/docs/guides/database/extensions/pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron) |
| Supabase Service Role | Nunca expor no frontend; usar somente em contexto server-side |
