# Controle de Terceiros — Contexto do Projeto

> **Última atualização:** 2026-03-14
> **Branch:** Main-terceiros

---

## 1. Visão Geral

Sistema web para **controle de presença e gestão de trabalhadores terceirizados** em operações logísticas (cliente principal: Souza Cruz). Permite registrar entrada/saída, turno, cargo, setor, motivo de acionamento e fornecedor de mão de obra. Possui painel administrativo, conformidade com LGPD e trilha de auditoria completa.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Roteamento | React Router v6 |
| Estado/Query | TanStack React Query v5 |
| UI Components | shadcn/ui + Radix UI |
| Estilo | Tailwind CSS + inline styles (páginas principais) |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel |
| Ícones | lucide-react |
| Sanitização | DOMPurify |

---

## 3. Estrutura de Pastas

```
src/
├── App.tsx                  # Roteamento principal + controle de sessão
├── main.tsx                 # Entry point React
├── globals.css / App.css    # Estilos globais
├── components/
│   ├── AttendanceForm.tsx   # Formulário legado (compatibilidade)
│   ├── ImportOptionsDialog.tsx
│   ├── MultiSelect.tsx
│   ├── OptionManager.tsx
│   ├── OptionsSheet.tsx
│   └── ui/                  # Todos os componentes shadcn/ui
├── hooks/
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── use-i18n.ts            # Hook useI18n() para acesso ao contexto de idioma
├── lib/
│   ├── attendance-storage.ts  # CRUD de registros via Supabase
│   ├── options-storage.ts     # CRUD de opções via Supabase
│   ├── supabase.ts            # Client Supabase + authReady promise
│   ├── i18n-translations.ts   # Traduções pt-BR/en-US + mapSupabaseError()
│   ├── i18n-context.ts        # React.createContext do sistema i18n
│   ├── i18n.tsx               # I18nProvider (componente de contexto)
│   └── utils.ts               # cn() helper
├── pages/
│   ├── Index.tsx              # Página principal (lançamento + listagem)
│   ├── LoginPage.tsx          # Autenticação email/senha
│   ├── AdminPage.tsx          # Gerenciamento de usuários + conta
│   ├── ResetPasswordPage.tsx  # Redefinição de senha
│   ├── AttendancePage.tsx     # (legado)
│   ├── ManualOptionsInputPage.tsx
│   ├── OptionsManagementPage.tsx
│   └── NotFound.tsx
├── types/
│   └── attendance.ts          # Interfaces: Registro, AttendanceRecord, SelectOption
└── utils/
    └── toast.ts
supabase/
├── schema.sql                 # Schema base completo
└── migrations/
    ├── admin_setup.sql        # Tabela profiles + is_admin() + trigger
    ├── audit_log.sql          # Tabela de auditoria
    ├── fix_linter_warnings.sql
    ├── fix_rls_write_policies.sql
    ├── retention_policy.sql
    ├── terceiros_table.sql    # Tabela de nomes de terceirizados
    └── user_management.sql    # ON DELETE CASCADE + trigger sync email
supabase/functions/
└── admin-users/
    └── index.ts               # Edge Function: criar, editar, excluir usuários
```

---

## 4. Banco de Dados (Supabase)

### Tabelas

| Tabela | Descrição |
|---|---|
| `registros` | Registros de presença dos terceirizados |
| `opcoes` | Listas de seleção configuráveis (chave/valor) |
| `terceiros` | Cadastro de nomes de colaboradores terceirizados |
| `profiles` | Perfis de usuário com flag `is_admin` |
| `audit_log` | Trilha de auditoria de operações |

### Schema `registros`

```sql
id           TEXT  PK
lote_id      TEXT  (nullable) — agrupa lançamentos em lote
data         DATE
turno        TEXT
hora_entrada TEXT
hora_saida   TEXT
total_horas  TEXT
nome         TEXT
cargo        TEXT
setor        TEXT
unidade      TEXT
cc           TEXT  (centro de custo)
motivo       TEXT
fornecedor   TEXT
obs          TEXT
created_at   TIMESTAMPTZ
```

### Schema `opcoes`

```sql
id        BIGINT  PK (identity)
chave     TEXT    (ex: "turnos", "unidades", "cargos"...)
valor     TEXT
criado_em TIMESTAMPTZ
UNIQUE(chave, valor)
```

### Schema `profiles`

```sql
id         UUID  PK (FK → auth.users)
email      TEXT
is_admin   BOOLEAN  DEFAULT false
created_at TIMESTAMPTZ
```

### RLS

- **SELECT** em `registros` e `opcoes`: permitido para `anon` e `authenticated`
- **INSERT/UPDATE/DELETE** em `registros` e `opcoes`: apenas `authenticated`
- **profiles**: cada usuário vê apenas o próprio perfil; admins veem todos
- Função `public.is_admin()` usada nas políticas sem recursão (SECURITY DEFINER)

---

## 5. Autenticação

- Supabase Auth com **email + senha**
- `App.tsx` gerencia sessão via componente interno `AppRoutes` (dentro de `<BrowserRouter>`) que usa `useNavigate`
- Fluxo de **recuperação de senha**: evento `PASSWORD_RECOVERY` é detectado em `onAuthStateChange` → `navigate("/reset-password")` automático
- Condição de corrida evitada: quando URL tem `type=recovery` no hash, `loading=false` só é definido após `onAuthStateChange` disparar
- `ResetPasswordPage` é autônoma: verifica sessão própria, em sucesso faz `signOut` e redireciona para `/login`
- `authReady` (promise exportada de `supabase.ts`): espera sessão disponível antes de qualquer operação de escrita
- E-mail de redefinição aponta para `/reset-password` (não mais `/login`)

### Rotas

| Rota | Acesso | Componente |
|---|---|---|
| `/login` | Público | `LoginPage` |
| `/` | Autenticado | `Index` |
| `/admin` | Autenticado | `AdminPage` |
| `/reset-password` | Aberto (requer token de recuperação) | `ResetPasswordPage` |
| `*` | Qualquer | `NotFound` |

---

## 6. Lógica de Negócio Principal (Index.tsx)

### Campos de Lançamento

| Campo | Tipo | Chave `opcoes` |
|---|---|---|
| Turno | select | `turnos` |
| Unidade | select | `unidades` |
| Fornecedor | select | `fornecedores` |
| Motivo | select | `motivos` |
| Cargo | select | `cargos` |
| Centro de Custo | select | `ccList` |
| Setor | select | `setores` |
| Nome | autocomplete | `terceiros` (tabela própria) |

### Valores Default

```
Turnos:       1ª TURNO, 2ª TURNO, 3ª TURNO, INTERMEDIÁRIO
Unidades:     HUB, COD DIURNO, COD NOTURNO, Administrativo
Fornecedores: LIDER MASTER, TRANSLOG, SERVILOG, LOGFLEX, OUTRO
Motivos:      OPERAÇÃO BAT HUB BRASIL, REFORÇO TURNO, COBERTURA FALTA, PROJETO ESPECIAL, OUTRO
Cargos:       AUXILIAR DE DEPÓSITO, CONFERENTE JR, CONFERENTE SR, OPERADOR DE EMPILHADEIRA,
              LÍDER OPERACIONAL, SUPERVISOR, ANALISTA, COORDENADOR
CC:           100001 - SOUZA CRUZ-COD, 100002 - SOUZA CRUZ-HUB, 100003 - ADMINISTRATIVO
Setores:      RECEBIMENTO, EXPEDIÇÃO, SEPARAÇÃO, CONFERÊNCIA, ENDEREÇAMENTO, ADMINISTRATIVO, PÁTIO
```

### Lançamento em Lote

- É possível lançar até **20 pessoas** num único formulário compartilhando os campos comuns
- Todos os registros do lote compartilham o mesmo `loteId`
- Cada linha permite sobrescrever `horaEntrada` / `horaSaida` individualmente

### Persistência (useStorage hook)

- Carrega registros do Supabase na inicialização, aguardando `authReady`
- `save(newVal)` faz diff com `prevRef`: detecta deletados (DELETE) e inseridos/alterados (UPSERT)
- Purga automática LGPD: remove registros com `data < hoje - 5 anos`

### Persistência de Opções (useOpcoes hook)

- Carrega `opcoes` e `terceiros` em paralelo
- Sincroniza incrementalmente: apenas adiciona/remove os valores que mudaram
- Lotes de 100 itens (CHUNK) para evitar limites do Supabase

---

## 7. LGPD

- **Base legal:** Obrigação legal + execução de contrato (Art. 7º, II e V)
- **Retenção:** 5 anos (`RETENCAO_ANOS = 5`), purga automática client-side na carga
- **Auditoria:** Tabela `audit_log` registra INSERT, UPDATE, DELETE, PURGE, EXCLUSAO_TITULAR
- **Aviso de Privacidade:** Modal exibido antes do uso, aceite salvo em `localStorage("lgpd_aceito")`
- **DPO:** Nome e e-mail configuráveis via opcoes (`dpoNome`, `dpoEmail`)
- **Segurança:** RLS no Supabase + sessão autenticada obrigatória para escrita

---

## 8. Painel Administrativo (AdminPage.tsx)

- Acesso restrito a usuários com `is_admin = true` no `profiles`
- **Aba Usuários:**
  - Lista todos os usuários com stats (total, admins, comuns)
  - **Novo usuário:** botão abre modal para criar usuário (e-mail + senha + flag admin)
  - **Editar:** botão ⌘ por linha — altera e-mail e/ou senha do usuário
  - **Excluir:** botão 🗑 por linha — remove permanentemente (não pode excluir a si mesmo)
  - Toggle admin: promove/revoga permissão de administrador
  - Envio de e-mail de redefinição de senha
- **Aba Conta:** alteração de senha do usuário logado

### Edge Function `admin-users`

O CRUD de usuários usa a Edge Function `supabase/functions/admin-users/index.ts`.
Ela usa `SUPABASE_SERVICE_ROLE_KEY` (secret do Supabase, nunca exposta no frontend).

**Deploy:**
```bash
supabase functions deploy admin-users
```

**Ações:**
| Ação | Payload |
|---|---|
| `create` | `{ email, password, is_admin? }` |
| `update` | `{ userId, email?, password? }` |
| `delete` | `{ userId }` |

---

## 9. Variáveis de Ambiente

```
VITE_SUPABASE_URL       URL do projeto Supabase
VITE_SUPABASE_ANON_KEY  Chave anon pública do Supabase
```

Fallback para `https://placeholder.supabase.co` em dev sem `.env`.

---

## 10. Comandos

```bash
pnpm dev        # servidor de desenvolvimento
pnpm build      # build de produção
pnpm build:dev  # build em modo development
pnpm lint       # ESLint
pnpm preview    # preview do build
```

---

## 12. Internacionalização (i18n)

O app suporta **pt-BR** (padrão) e **en-US**, com persistência em `localStorage("app_lang")`.

### Arquitetura

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/i18n-translations.ts` | Objeto `translations` com todas as chaves, tipo `Lang`, tipo `TranslationKey`, função `mapSupabaseError()` |
| `src/lib/i18n-context.ts` | `createContext<I18nContext>` com valor padrão |
| `src/lib/i18n.tsx` | Componente `I18nProvider` (envolve `<App>`) |
| `src/hooks/use-i18n.ts` | Hook `useI18n()` → retorna `{ lang, setLang, t }` |

### Uso

```tsx
import { useI18n } from "@/hooks/use-i18n";
import { mapSupabaseError } from "@/lib/i18n-translations";

const { lang, setLang, t } = useI18n();
// t("login_btn") → "Entrar" ou "Sign in"
// mapSupabaseError(error.message, lang) → mensagem traduzida
```

### Seletor de Idioma

- Exibido na `LoginPage` acima do logo
- Dois botões com código de texto: **BR** Português / **US** English (borda ativa = azul, inativo = cinza)
- Troca de idioma em tempo real sem recarregar

### Páginas/Componentes Traduzidos

- `LoginPage` — completa (labels, placeholders, erros, seletor de idioma)
- `ResetPasswordPage` — completa (labels, erros, mensagens de status)
- `AdminPage` — mensagens de feedback (e-mail enviado, erros de senha)
- `Index.tsx` — completa: PrivacyNotice, FormLancamento, Lancamentos, Dashboard, Fornecedores, Configuracoes (incl. DPO e LGPD exclusão), navbar (Hoje/Mês/Admin/Sair/abas de navegação)

---

## 13. Convenções de Código

- Todo código fonte em `src/`
- Páginas em `src/pages/`, componentes em `src/components/`
- Path alias `@/` aponta para `src/`
- Usar shadcn/ui para componentes de UI — **não editar** arquivos em `src/components/ui/`
- Estilo: Tailwind CSS preferencialmente; inline styles usados nas páginas principais (Index, Login, Admin)
- Tipagem estrita: evitar `any`, usar `unknown` quando necessário
- Sanitizar entrada do usuário com `DOMPurify` antes de persistir (ver `options-storage.ts`)

---

## 14. Histórico de Alterações

| Data | Alteração |
|---|---|
| 2026-03-14 | Arquivo de contexto criado com levantamento completo do projeto |
| 2026-03-14 | Corrigido fluxo de redefinição de senha: rota /reset-password dedicada, AppRoutes com useNavigate dentro do BrowserRouter, ResetPasswordPage autônoma sem prop onDone |
| 2026-03-14 | Implementado sistema i18n pt-BR/en-US: i18n-translations.ts, i18n-context.ts, i18n.tsx (provider), use-i18n.ts (hook); seletor de idioma na LoginPage; tradução de LoginPage, ResetPasswordPage e AdminPage; mapSupabaseError para mensagens de erro do Supabase em português/inglês |
| 2026-03-14 | Gerenciamento de usuários na AdminPage: criar, editar, excluir via Edge Function admin-users (service_role segura); modal CRUD; migração user_management.sql |
| 2026-03-14 | Expandida internacionalização (i18n) para todo o app: Index.tsx coberto completamente (PrivacyNotice, FormLancamento, Lancamentos, Dashboard, Fornecedores, Configuracoes, Navbar); seletor de idioma reformatado para texto BR/US em vez de emojis |
| 2026-03-14 | Varredura de bugs e segurança: corrigido locale hardcoded "pt-BR" em AdminPage (toLocaleDateString), relógio do header e função fmt/fmtMes em Index.tsx — agora usam lang do useI18n(); adicionado layout responsivo completo via CSS media queries (rsp-grid-2/3/4, rsp-main, rsp-nav-label, rsp-header-stats) em Index.tsx e AdminPage.tsx; grids de Dashboard, FormLancamento (G component), DPO e Nomes em Configuracoes, e stats do Admin tornam-se responsivos; grid de colaboradores no FormLancamento agora tem overflow horizontal; tabela de usuários no Admin com scroll horizontal; header colapsável no mobile |
