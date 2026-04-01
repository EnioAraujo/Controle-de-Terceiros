# Correções — Auditoria de Segurança · Controle de Terceiros

> Gerado em 31/03/2026 · Score pré-correção: **8.2/10** · Estimativa pós-correção: **9.4/10**

---

## 🔴 MÉDIA — Correção 1: Inconsistência na senha mínima

**Arquivo:** `src/pages/AdminPage.tsx`  
**Linha:** ~922 (modal "Criar usuário")  
**OWASP:** A07:2025 — Identification and Authentication Failures

### Problema

O fluxo de troca de senha exige 8 caracteres, mas o modal de criação de usuário exige apenas 6.

```tsx
// ❌ ANTES (linha ~922)
if (newPassword.length < 6) { setCreateError(t("admin_err_pwd_short")); return; }
```

### Correção

**Passo 1** — Adicione a constante no topo do arquivo (antes do componente `AdminPage`):

```tsx
// Adicione após os imports, antes de "type AppRole = ..."
const MIN_PASSWORD_LENGTH = 8;
```

**Passo 2** — Substitua a validação no modal:

```tsx
// ✅ DEPOIS (linha ~922)
if (newPassword.length < MIN_PASSWORD_LENGTH) {
  setCreateError(t("admin_err_pwd_short"));
  return;
}
```

**Passo 3** — Atualize a validação existente de `handleChangePassword` para usar a constante:

```tsx
// ✅ DEPOIS (linha ~413)
if (newPass.length < MIN_PASSWORD_LENGTH) {
  setPassMsg({ ok: false, text: t("admin_pass_short") });
  return;
}
```

**Passo 4** *(opcional)* — Atualize as strings de i18n para refletir "mínimo 8 caracteres":

```ts
// src/lib/i18n-translations.ts
// Localize as chaves "admin_err_pwd_short" e "admin_pass_short" e ajuste para "8"
```

---

## 🔴 MÉDIA — Correção 2: MFA unenroll sem confirmação de senha

**Arquivo:** `src/pages/AdminPage.tsx`  
**Função:** `handleMfaUnenroll`  
**OWASP:** A04:2025 — Insecure Design

### Problema

O MFA pode ser removido com um único clique, sem pedir a senha atual. Um atacante com sessão ativa pode desativar a 2FA sem qualquer barreira.

```tsx
// ❌ ANTES
const handleMfaUnenroll = async (factorId: string) => {
  setMfaLoading(true);
  setMfaMsg(null);
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    ...
  }
};
```

### Correção

**Passo 1** — Adicione os estados de confirmação junto aos outros estados de MFA:

```tsx
// Adicione junto ao bloco de estados de MFA (após "mfaMsg")
const [unenrollConfirmPass, setUnenrollConfirmPass] = useState("");
const [isUnenrollOpen, setIsUnenrollOpen] = useState(false);
const [unenrollFactorId, setUnenrollFactorId] = useState("");
```

**Passo 2** — Substitua a função `handleMfaUnenroll`:

```tsx
// ✅ DEPOIS — abre o dialog de confirmação
const openUnenrollDialog = (factorId: string) => {
  setUnenrollFactorId(factorId);
  setUnenrollConfirmPass("");
  setMfaMsg(null);
  setIsUnenrollOpen(true);
};

const handleMfaUnenroll = async () => {
  if (!unenrollConfirmPass.trim()) {
    setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Informe sua senha atual." : "Enter your current password." });
    return;
  }

  setMfaLoading(true);
  setMfaMsg(null);
  try {
    // Reautentica para confirmar identidade antes de remover MFA
    const { error: reAuthErr } = await supabase.auth.signInWithPassword({
      email: myEmail,
      password: unenrollConfirmPass,
    });

    if (reAuthErr) {
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Senha incorreta." : "Incorrect password." });
      setUnenrollConfirmPass("");
      return;
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId: unenrollFactorId });
    if (error) {
      setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao remover MFA." : "Error removing MFA." });
      return;
    }

    setMfaMsg({ ok: true, text: lang === "pt-BR" ? "MFA removido." : "MFA removed." });
    setMfaEnrollStep("idle");
    setIsUnenrollOpen(false);
    await loadMfaFactors();
  } catch (err) {
    console.error("Erro ao remover MFA:", err);
    setMfaMsg({ ok: false, text: lang === "pt-BR" ? "Erro ao remover MFA." : "Error removing MFA." });
  } finally {
    setMfaLoading(false);
    setUnenrollConfirmPass("");
  }
};
```

**Passo 3** — Substitua o botão "Desativar MFA" no JSX:

```tsx
// ✅ DEPOIS — chama openUnenrollDialog em vez de handleMfaUnenroll
{mfaFactors.map(f => (
  <Button
    key={f.id}
    variant="destructive"
    size="sm"
    className="w-full"
    disabled={mfaLoading}
    onClick={() => openUnenrollDialog(f.id)}
  >
    {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
    {lang === "pt-BR" ? "Desativar MFA" : "Disable MFA"}
  </Button>
))}
```

**Passo 4** — Adicione o `AlertDialog` de confirmação (antes do `AlertDialog` de exclusão existente):

```tsx
{/* AlertDialog: Confirmar remoção de MFA */}
<AlertDialog open={isUnenrollOpen} onOpenChange={v => { if (!mfaLoading) setIsUnenrollOpen(v); }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        {lang === "pt-BR" ? "Confirmar desativação do MFA" : "Confirm MFA deactivation"}
      </AlertDialogTitle>
      <AlertDialogDescription>
        {lang === "pt-BR"
          ? "Esta ação removerá a autenticação em duas etapas da sua conta. Confirme sua senha atual para continuar."
          : "This will remove two-factor authentication from your account. Enter your current password to continue."}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="py-2">
      <Input
        type="password"
        placeholder={lang === "pt-BR" ? "Senha atual" : "Current password"}
        value={unenrollConfirmPass}
        onChange={e => setUnenrollConfirmPass(e.target.value)}
        autoFocus
        autoComplete="current-password"
      />
      {mfaMsg && !mfaMsg.ok && (
        <p className="text-sm text-red-600 mt-2">{mfaMsg.text}</p>
      )}
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={mfaLoading}>
        {lang === "pt-BR" ? "Cancelar" : "Cancel"}
      </AlertDialogCancel>
      <AlertDialogAction
        onClick={handleMfaUnenroll}
        disabled={mfaLoading || !unenrollConfirmPass.trim()}
        className="bg-red-600 hover:bg-red-700"
      >
        {mfaLoading
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{lang === "pt-BR" ? "Removendo..." : "Removing..."}</>
          : <><ShieldOff className="h-4 w-4 mr-2" />{lang === "pt-BR" ? "Desativar MFA" : "Disable MFA"}</>
        }
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 🔴 MÉDIA — Correção 3: console.* sem guard DEV em produção

**Arquivos:** `src/hooks/useStorage.ts`, `src/hooks/useOpcoes.ts`  
**OWASP:** A09:2025 — Security Logging and Monitoring Failures

### Opção A — Guard manual (sem dependência extra)

Substitua cada ocorrência em `useStorage.ts` e `useOpcoes.ts`:

```ts
// ❌ ANTES
console.debug(`[OFFLINE_QUEUE] Processando ${queue.operations.length} operações pendentes`);
console.error("Erro ao carregar registros:", error.message);
console.debug("[OFFLINE_QUEUE] Conexão restaurada");
console.debug("[OFFLINE_QUEUE] Conexão perdida");
console.debug("[OFFLINE_QUEUE] Todas as operações pendentes sincronizadas");
console.error(`[OFFLINE_QUEUE] Erros: ${errors.join("; ")}`);
console.debug("[OFFLINE_QUEUE] Offline - adicionando operações à fila");
console.error("[SYNC_ERRORS]", combinedError);
console.debug(`[OFFLINE_QUEUE] Tentando sincronizar ${n} operações`);
console.debug("[OFFLINE_QUEUE] Nenhuma operação pendente");

// ✅ DEPOIS — envolva todos com:
if (import.meta.env.DEV) console.debug(`[OFFLINE_QUEUE] ...`);
if (import.meta.env.DEV) console.error("Erro ao carregar registros:", error.message);
// etc.
```

> **Atenção:** O `console.error` em `main.tsx` linha 7 (`Unhandled promise rejection`) pode ser mantido sem guard — ele é útil em produção para rastrear erros críticos sem expor detalhes internos.

### Opção B — Strip automático via Vite (recomendado)

```bash
# Instale o plugin
npm install -D vite-plugin-remove-console
# ou
pnpm add -D vite-plugin-remove-console
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import removeConsole from "vite-plugin-remove-console"; // ← adicione
import path from "path";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "production" && removeConsole({ includes: ["log", "debug", "warn"] }), // mantém console.error
  ].filter(Boolean),
  // ... resto da config
}));
```

---

## 🟡 BAIXA — Correção 4: JWT decodificado duplicado em App.tsx

**Arquivo:** `src/App.tsx`  
**Linhas:** ~43 e ~103

### Problema

A lógica de decode de JWT aparece duas vezes. A função `decodeSessionAal` já existe mas não é reutilizada.

```tsx
// ❌ ANTES (linha ~102-106) — decode inline duplicado
const jwtPayload = JSON.parse(
  atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
) as { aal?: string };
if (jwtPayload.aal === "aal1") { ... }
```

### Correção

Substitua o bloco duplicado pela chamada à função existente:

```tsx
// ✅ DEPOIS — reutilize decodeSessionAal (já definida no topo do arquivo)
if (decodeSessionAal(session) === "aal1") {
  // MFA pendente: não redireciona
  return;
}
```

---

## 🟡 BAIXA — Correção 5: dangerouslySetInnerHTML sem sanitização em chart.tsx

**Arquivo:** `src/components/ui/chart.tsx`  
**Linha:** ~86

### Correção

```tsx
// ❌ ANTES
<style
  dangerouslySetInnerHTML={{
    __html: Object.entries(THEMES)
      .map(([theme, colors]) => `...`)
      .join("\n"),
  }}
/>

// ✅ DEPOIS — use uma <style> tag via efeito, sem dangerouslySetInnerHTML
import { useEffect, useRef } from "react";

// Dentro do componente ChartStyle (ou equivalente):
const cssString = Object.entries(THEMES)
  .map(([theme, colors]) => `...`)
  .join("\n");

useEffect(() => {
  const el = document.createElement("style");
  el.setAttribute("data-chart-theme", "true");
  el.textContent = cssString; // textContent é seguro — não interpreta HTML
  document.head.appendChild(el);
  return () => { el.remove(); };
}, [cssString]);

// Remova o elemento <style dangerouslySetInnerHTML=...> do JSX
```

---

## 🟡 BAIXA — Correção 6: lang="en" no index.html

**Arquivo:** `index.html`  
**Linha:** 2

```html
<!-- ❌ ANTES -->
<html lang="en">

<!-- ✅ DEPOIS -->
<html lang="pt-BR">
```

**Bônus** — atualização dinâmica quando usuário troca idioma:

```ts
// src/lib/i18n.tsx — dentro do setLang ou useEffect que reage à mudança de lang
useEffect(() => {
  document.documentElement.lang = lang; // "pt-BR" ou "en-US"
}, [lang]);
```

---

## 🟡 BAIXA — Correção 7: Migrar formulários para Zod

**Arquivo:** `src/pages/AdminPage.tsx` (e futuramente `LoginPage.tsx`)  
**Dependências:** já instaladas (`zod`, `react-hook-form`, `@hookform/resolvers`)

> Esta é a correção com maior esforço de implementação. Priorize após as anteriores.

### Schema sugerido para criação de usuário

```ts
// Adicione no topo de AdminPage.tsx (após imports)
import { z } from "zod";

const createUserSchema = z.object({
  email: z
    .string()
    .min(1, "E-mail é obrigatório")
    .email("Formato de e-mail inválido"),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`)
    .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Deve conter ao menos um número"),
  is_admin: z.boolean().default(false),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
```

### Schema sugerido para troca de senha

```ts
const changePasswordSchema = z
  .object({
    newPass: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`),
    confirmPass: z.string(),
  })
  .refine(data => data.newPass === data.confirmPass, {
    message: "As senhas não coincidem",
    path: ["confirmPass"],
  });
```

---

## ✅ Checklist de aplicação

| # | Arquivo | Prioridade | Status |
|---|---------|-----------|--------|
| 1 | `AdminPage.tsx` — senha mínima 6→8 | 🔴 Médio | [ ] |
| 2 | `AdminPage.tsx` — MFA unenroll com confirmação | 🔴 Médio | [ ] |
| 3 | `useStorage.ts` — console.* com guard DEV | 🔴 Médio | [ ] |
| 3 | `useOpcoes.ts` — console.* com guard DEV | 🔴 Médio | [ ] |
| 4 | `App.tsx` — remover decode JWT duplicado | 🟡 Baixo | [ ] |
| 5 | `chart.tsx` — substituir dangerouslySetInnerHTML | 🟡 Baixo | [ ] |
| 6 | `index.html` — lang="pt-BR" | 🟡 Baixo | [ ] |
| 6 | `i18n.tsx` — document.documentElement.lang dinâmico | 🟡 Baixo | [ ] |
| 7 | `AdminPage.tsx` — Zod schemas nos formulários | 🟡 Baixo | [ ] |

---

> **Após aplicar:** rode `npm run build` para garantir que nenhum type error foi introduzido e execute `npm audit` para verificar dependências.
