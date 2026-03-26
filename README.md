<div align="center">

# 📋 Controle de Terceiros

**Sistema de controle de presença de trabalhadores terceirizados**  
**Attendance control system for outsourced workers**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)
![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white)
![LGPD](https://img.shields.io/badge/LGPD-Conforme-0EA5E9)

</div>

---

## 📖 Sobre o Projeto / About

**pt-BR** — Sistema web para controle de presença e gestão de trabalhadores terceirizados em operações logísticas. Permite registrar entrada/saída, turno, cargo, fornecedor e operação de cada colaborador. Possui painel administrativo com RBAC, MFA, exportação PDF/Excel, compartilhamento via WhatsApp, projeção de demanda e trilha de auditoria completa conforme a LGPD.

**en-US** — Web system for attendance control and management of outsourced workers in logistics operations. Enables recording entry/exit, shift, role, supplier and operation per worker. Features an admin panel with RBAC, MFA, PDF/Excel export, WhatsApp sharing, demand projection and a complete audit trail compliant with Brazil's LGPD.

---

## ✅ Funcionalidades / Features

### pt-BR
- **Registro de presença** individual ou em lote (até 20 pessoas por lançamento)
- **Agrupamento por data e turno** na tabela de lançamentos
- **Validação anti-duplicata** em 4 camadas (intra-lote, banco, UNIQUE INDEX e verificação de duplo turno)
- **Exportação** de registros em CSV e PDF
- **Importação** de histórico via planilha Excel (.xlsx)
- **Compartilhamento via WhatsApp** com template de mensagem configurável, campos ordenáveis
- **Projeção de demanda futura** com distribuição proporcional por turno
- **Fechamento financeiro** por fornecedor/período com status (rascunho → enviado → revisão → aprovado)
- **Painel Admin** com RBAC, aprovação de usuários, MFA (TOTP), reset de senha
- **Internacionalização** pt-BR / en-US com troca em tempo real
- **Modo Mobile** com interface otimizada (FAB, cards, bottom sheet)
- **Conformidade LGPD** com aviso de privacidade, DPO, auditoria e exclusão por solicitação

### en-US
- **Individual or batch check-in** (up to 20 workers per entry)
- **Grouping by date and shift** in the records table
- **Anti-duplicate validation** in 4 layers (intra-batch, database, UNIQUE INDEX, double-shift check)
- **Export** records to CSV and PDF
- **Import** history from Excel spreadsheets (.xlsx)
- **WhatsApp sharing** with configurable message template and draggable field order
- **Future demand projection** with proportional distribution per shift
- **Financial closing** per supplier/period with status workflow
- **Admin panel** with RBAC, user approval, MFA (TOTP), password reset
- **Internationalization** pt-BR / en-US with real-time switching
- **Mobile mode** with optimized UI (FAB, cards, bottom sheet)
- **LGPD compliance** with privacy notice, DPO, audit trail and deletion on request

---

## 🏗️ Visão Geral da Arquitetura / Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                        BROWSER                           │
│                                                          │
│  React 18 SPA (Vite)                                     │
│  ├── React Router v6 (/, /mobile, /admin, /login, ...)   │
│  ├── TanStack React Query v5                             │
│  ├── shadcn/ui + Radix UI + Tailwind CSS                 │
│  └── i18n (pt-BR / en-US) via Context API               │
└──────────────┬───────────────────────────────────────────┘
               │ HTTPS
               ▼
┌──────────────────────────────────────────────────────────┐
│                   VERCEL (Deploy)                         │
│  ├── Static assets (React build)                         │
│  └── /api/admin-users  ← Serverless Function (Node.js)  │
│       └── usa SUPABASE_SERVICE_ROLE_KEY (server-only)    │
└──────────────┬───────────────────────────────────────────┘
               │ Supabase JS Client / REST
               ▼
┌──────────────────────────────────────────────────────────┐
│                    SUPABASE                               │
│  ├── PostgreSQL (tabelas: registros, opcoes, terceiros,  │
│  │   profiles, user_roles, audit_log, fechamentos, ...)  │
│  ├── Auth (email+senha, MFA/TOTP, sessões JWT)           │
│  ├── RLS (Row Level Security — políticas por tabela)     │
│  └── Edge Functions (admin-users — gestão de usuários)   │
└──────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack Tecnológico Completo / Full Tech Stack

| Camada / Layer | Tecnologia / Technology | Versão / Version |
|---|---|---|
| Framework UI | React | 18 |
| Linguagem / Language | TypeScript | 5 |
| Build | Vite | 6 |
| Roteamento / Routing | React Router | v6 |
| Estado remoto / Remote state | TanStack React Query | v5 |
| Componentes UI | shadcn/ui + Radix UI | latest |
| Estilo / Styling | Tailwind CSS | v3 |
| Backend / BaaS | Supabase (PostgreSQL + Auth + RLS) | v2 |
| Deploy | Vercel (Serverless Functions) | — |
| Testes / Tests | Vitest + @testing-library/react | v4 |
| Test environment | jsdom | — |
| Ícones / Icons | lucide-react | latest |
| Sanitização / Sanitization | DOMPurify | v3 |
| PDF Export | jsPDF + jspdf-autotable | v4 |
| Excel Import/Export | xlsx (SheetJS) | 0.18 |
| i18n | Context API custom (pt-BR / en-US) | — |

---

## 🔑 Variáveis de Ambiente / Environment Variables

Crie um arquivo `.env` na raiz do projeto baseado no [`.env.example`](.env.example):

_Create a `.env` file at the project root based on [`.env.example`](.env.example):_

| Variável | Escopo | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend (Vite) | URL do projeto Supabase / Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend (Vite) | Chave anon pública do Supabase / Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor — Vercel only | Chave service_role (nunca exposta no frontend) / service_role key (never exposed to client) |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` é configurada **apenas** nas variáveis de ambiente do dashboard da Vercel, nunca no repositório.  
> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` is set **only** in the Vercel dashboard env vars, never committed to the repo.

---

## 📁 Estrutura de Diretórios / Directory Structure

```
/
├── .env.example            # Variáveis de ambiente necessárias (sem valores)
├── vercel.json             # Configuração Vercel (headers de segurança, CSP, HSTS)
├── vite.config.ts
├── tailwind.config.ts
├── arquivolocal/
│   ├── CONTEXT.md          # ⭐ Contexto completo do projeto (leitura obrigatória)
│   ├── skill_tdd.md        # Diretrizes TDD para o Copilot
│   └── SEGURANCA_WEB_2025.md
├── api/
│   └── admin-users.ts      # Vercel Serverless Function (CRUD de usuários admin)
├── src/
│   ├── App.tsx             # Roteamento + controle de sessão + ErrorBoundary
│   ├── main.tsx            # Entry point + I18nProvider + unhandledrejection handler
│   ├── globals.css         # Media queries responsivos (rsp-*)
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   └── ui/             # Componentes shadcn/ui — NÃO EDITAR
│   ├── hooks/
│   │   ├── use-i18n.ts     # Hook useI18n() → { lang, setLang, t }
│   │   └── use-mobile.tsx
│   ├── lib/
│   │   ├── supabase.ts         # Client Supabase + authReady promise
│   │   ├── format-utils.ts     # Funções puras testáveis (calcHoras, fmt, buildWhatsAppMessage, ...)
│   │   ├── format-utils.test.ts
│   │   ├── fechamento-utils.ts # Lógica de fechamento financeiro
│   │   ├── fechamento-utils.test.ts
│   │   ├── i18n-translations.ts # Traduções + mapSupabaseError()
│   │   ├── i18n-translations.test.ts
│   │   ├── i18n-context.ts
│   │   ├── i18n.tsx
│   │   └── utils.ts            # cn() helper
│   ├── pages/
│   │   ├── Index.tsx           # Página principal (Desktop)
│   │   ├── MobileLancamentosPage.tsx # Versão mobile
│   │   ├── ProjecaoPage.tsx    # Projeção de demanda
│   │   ├── LoginPage.tsx       # Auth + seletor de modo (mobile/desktop)
│   │   ├── AdminPage.tsx       # Painel admin (Usuários / Permissões / Conta)
│   │   └── ResetPasswordPage.tsx
│   ├── test/
│   │   └── setup.ts
│   └── types/
│       └── attendance.ts       # Interfaces: Registro, SelectOption, WhatsAppTemplate
├── supabase/
│   ├── schema/schema.sql       # Schema base completo
│   └── migrations/             # Migrations incrementais
└── arquivolocal/REGRAS_FECHAMENTO.md  # Regras de negócio do fechamento financeiro
```

---

## 🧩 Serviços, Jobs e Models / Services, Jobs & Models

### Interfaces TypeScript (Models)

```typescript
// src/types/attendance.ts
interface Registro {
  id: string; loteId?: string; data: string; turno: string;
  horaEntrada: string; horaSaida: string; totalHoras: string;
  nome: string; cargo: string; setor: string; unidade: string;
  cc: string; motivo: string; fornecedor: string; obs: string;
}

// src/lib/format-utils.ts
type WhatsAppField = "data"|"turno"|"nome"|"cargo"|"fornecedor"|"unidade"|
                     "cc"|"horaEntrada"|"horaSaida"|"totalHoras"|"motivo"|"obs";
interface WhatsAppTemplate { header: string; campos: WhatsAppField[]; }
```

### Serviços / Services

| Serviço | Localização | Responsabilidade |
|---|---|---|
| `Supabase Client` | `src/lib/supabase.ts` | Client JS + `authReady` promise |
| `useStorage` hook | `src/pages/Index.tsx` | Carrega/salva registros com diff incremental |
| `useOpcoes` hook | `src/pages/Index.tsx` | Sincroniza listas de opções configuráveis |
| `Vercel API Route` | `api/admin-users.ts` | CRUD de usuários admin (usa service_role) |
| `buildWhatsAppMessage` | `src/lib/format-utils.ts` | Monta mensagem formatada para WhatsApp |

### Jobs Automáticos / Automated Jobs

| Job | Quando dispara | O que faz |
|---|---|---|
| **Purga LGPD** | Na inicialização do app (client-side) | Remove registros com `data < hoje - 5 anos` |
| **Purga DB** | `retention_policy.sql` (cron Supabase) | Mesma regra, executada no banco |
| **Sync is_admin** | Trigger `sync_is_admin_from_role` | Mantém `profiles.is_admin` sincronizado com `user_roles.role` |
| **Sync email** | Trigger `user_management.sql` | Propaga e-mail de `auth.users` para `profiles` |

---

## 🎨 Design Patterns

### `authReady` Promise
Todas as operações de escrita no Supabase aguardam a promise `authReady` (exportada de `supabase.ts`) antes de executar, evitando race conditions de sessão.

```typescript
authReady.then(async () => {
  const { error } = await supabase.from("registros").insert(payload);
}).catch(err => console.error(err));
```

### `useStorage` Diff Pattern
O hook de persistência compara o novo estado com `prevRef.current` para detectar exatamente quais registros foram inseridos/alterados (UPSERT) e quais foram removidos (DELETE), sem reescrever tudo.

### Componentes em Escopo de Módulo
Sub-componentes reutilizados (ex: `const G = ...`) **devem ser definidos fora** da função do componente pai. Se definidos dentro, React trata como tipo novo a cada render e desmonta/remonta os filhos, causando perda de foco nos inputs.

```typescript
// ✅ CORRETO — escopo de módulo
const G = ({ children, cols }: Props) => <div className="rsp-grid-2">...</div>;
export function FormLancamento() { ... }

// ❌ ERRADO — dentro do componente pai
export function FormLancamento() {
  const G = ({ children }: Props) => <div>...</div>; // nova referência a cada render!
}
```

### Validação em Profundidade (Anti-Duplicata)
A validação de negócio crítica (ex: duplicatas) ocorre no ponto mais próximo da persistência (`salvar()` no componente-pai), não no componente-filho que pode ter estado stale via props.

### Conventional Commits
```
feat(escopo): descrição   | fix(escopo): ...  | refactor(escopo): ...
style(escopo): ...        | chore(escopo): ... | docs(escopo): ...
db(escopo): ...           | test(escopo): ...
```

### TDD — Red → Green → Refactor
Toda nova lógica de negócio em `src/lib/` deve ter testes correspondentes. Ver `arquivolocal/skill_tdd.md`.

---

## 🚀 Pré-requisitos e Rodando Localmente / Prerequisites & Local Setup

### Pré-requisitos
- Node.js >= 20
- pnpm >= 9
- Conta [Supabase](https://supabase.com) com projeto criado
- (Opcional) Conta [Vercel](https://vercel.com) para deploy

### Passos / Steps

```bash
# 1. Clonar o repositório
git clone https://github.com/EnioAraujo/Controle-de-Terceiros.git
cd Controle-de-Terceiros

# 2. Instalar dependências
pnpm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com as credenciais do seu projeto Supabase

# 4. Rodar as migrations no Supabase
# Execute os arquivos em supabase/migrations/ na ordem pelo SQL Editor
# ou use o Supabase CLI: supabase db push

# 5. Iniciar o servidor de desenvolvimento
pnpm dev
# Acesse: http://localhost:5173
```

---

## 🧪 Testes / Tests

```bash
pnpm test          # Executa todos os testes (Vitest) — obrigatório antes de commitar
pnpm test:watch    # Modo watch (desenvolvimento)
```

- Testes co-localizados com os módulos: `src/lib/*.test.ts`
- Framework: **Vitest** + **@testing-library/react** + **jsdom**
- **Nunca commitar com testes falhando**

---

## 📦 Pipeline CI/CD

```
git push → Main-terceiros
    │
    ├─► GitHub recebe o push
    │
    └─► Vercel Webhook ativado
            │
            ├── pnpm install
            ├── pnpm build        (vite build)
            ├── Deploy estático   (React SPA)
            └── Deploy API Route  (api/admin-users.ts → Serverless Node.js)
```

> **Não há etapa de testes automáticos no CI/CD da Vercel.** Os testes devem ser executados localmente com `pnpm test` **antes** de cada push.

### Comandos disponíveis

```bash
pnpm dev           # Servidor de desenvolvimento (Vite HMR)
pnpm build         # Build de produção
pnpm build:dev     # Build em modo development
pnpm lint          # ESLint
pnpm preview       # Preview local do build de produção
pnpm test          # Testes unitários (Vitest)
pnpm test:watch    # Testes em modo watch
```

---

## ⏱️ Agendamentos Automáticos / Automated Schedules

| Job | Trigger | Ação |
|---|---|---|
| **Purga LGPD (client)** | Toda inicialização do app | DELETE WHERE `data < now() - 5 years` |
| **Purga LGPD (banco)** | Cron Supabase (`retention_policy.sql`) | Mesma regra executada diretamente no PostgreSQL |
| **Sync `is_admin`** | Trigger após INSERT/UPDATE em `user_roles` | Mantém `profiles.is_admin` consistente com o role |
| **Sync email** | Trigger após INSERT em `auth.users` | Copia e-mail para `profiles.email` |

---

## 🚧 Common Hurdles — Problemas Conhecidos e Soluções

### 1. Input perdendo foco ao digitar (focus loss)
**Causa:** Sub-componente (ex: `const G`) definido *dentro* de um componente pai. Cada digitação → re-render → nova referência de tipo → React desmonta e remonta o filho.  
**Solução:** Mover o sub-componente para **escopo de módulo** (fora da função pai).

### 2. RLS silenciosamente bloqueando queries
**Causa:** A tabela tem política SELECT faltante. O Supabase precisa de SELECT para resolver conflitos em UPSERT (`onConflict`).  
**Solução:** Verificar `supabase/migrations/fix_rls_select_authenticated.sql`. Toda tabela precisa de política SELECT para `role authenticated`.

### 3. `authReady` não aguardado → operações antes da sessão
**Causa:** Supabase operações iniciadas antes da sessão ser restaurada (race condition).  
**Solução:** Envolver toda operação de escrita em `authReady.then(async () => { ... })`.

### 4. Duplicatas após correção (estado stale)
**Causa:** Validação no componente-filho recebe `registros` via prop, que pode estar desatualizada.  
**Solução:** Validar no ponto de persistência (`salvar()` no pai), que acessa o state diretamente.

### 5. RLS recursão infinita em `profiles`
**Causa:** Política de SELECT em `profiles` que chama `is_admin()` que consulta `profiles` → loop.  
**Solução:** Usar `supabase.rpc('is_admin')` (SECURITY DEFINER) que bypassa RLS. Nunca consultar `profiles` diretamente para verificar admin.

### 6. `toTitleCase` com acentos quebrados
**Causa:** `replace(/\b\w/g, c => c.toUpperCase())` — `\b` é ASCII-only; quebra em `ã`, `é`, `ç` etc.  
**Solução:** `s.toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")`.

### 7. Vercel API Route não recebe `SUPABASE_SERVICE_ROLE_KEY`
**Causa:** Variável não configurada no dashboard da Vercel (não pode vir do `.env` do repositório).  
**Solução:** Acessar Vercel → Project → Settings → Environment Variables → adicionar `SUPABASE_SERVICE_ROLE_KEY`.

---

## 🔒 Conformidade LGPD / LGPD Compliance

| Aspecto | Implementação |
|---|---|
| **Base legal** | Art. 7º, II (obrigação legal) + V (execução de contrato) |
| **Retenção de dados** | 5 anos — purga automática client-side e via cron no banco |
| **Auditoria** | Tabela `audit_log` registra INSERT, UPDATE, DELETE, PURGE, EXCLUSAO_TITULAR |
| **Aviso de Privacidade** | Modal exibido antes do uso; aceite salvo em `localStorage("lgpd_aceito")` |
| **DPO** | Nome, e-mail e telefone configuráveis pelo admin (Art. 41) |
| **Exclusão por Solicitação** | Funcionalidade de busca + exclusão de titular (Art. 18), admin-only |
| **Segurança** | RLS no Supabase + DOMPurify + HSTS + CSP no vercel.json |

---

## ✅ Checklist Pós-Implementação / Post-Implementation Checklist

Antes de cada commit / Before each commit:

```bash
# 1. Verificar tipos TypeScript
npx tsc --noEmit

# 2. Executar todos os testes
pnpm test

# 3. Atualizar CONTEXT.md (seções relevantes + histórico)
# arquivolocal/CONTEXT.md → Seção 14 (Histórico)

# 4. Commitar e publicar
git add -A
git commit -m "tipo(escopo): descrição em português"
git push
```

- [ ] TypeScript compila sem erros (`npx tsc --noEmit`)
- [ ] Todos os testes passam (`pnpm test`)
- [ ] `arquivolocal/CONTEXT.md` atualizado (seção relevante + histórico)
- [ ] Mensagem de commit no padrão Conventional Commits
- [ ] Push realizado (Vercel inicia deploy automático)

---

## 🤝 Contribuindo / Contributing

### Antes de qualquer alteração de código

1. Ler [`arquivolocal/CONTEXT.md`](arquivolocal/CONTEXT.md) — visão geral, schema, convenções
2. Ler [`arquivolocal/skill_tdd.md`](arquivolocal/skill_tdd.md) — diretrizes de TDD obrigatórias

### Regras

- **NÃO editar** arquivos em `src/components/ui/` (gerados pelo shadcn/ui)
- Criar novos componentes em vez de modificar os do shadcn
- Lógica de negócio pura vai em `src/lib/` (facilita testes)
- Inputs do usuário sempre sanitizados com `DOMPurify` antes de persistir
- Sempre aguardar `authReady` antes de operações de escrita no Supabase
- Log de auditoria obrigatório para INSERT, UPDATE, DELETE, PURGE

### Formato de Commits

```
feat(auth): adiciona rota dedicada /reset-password
fix(form): corrige perda de foco no campo observação
db(migrations): adiciona coluna obs na tabela registros
docs(readme): atualiza stack tecnológico
```

---

<div align="center">
  <sub>Mantido por <a href="https://github.com/EnioAraujo">EnioAraujo</a> · Branch <code>Main-terceiros</code></sub>
</div>
