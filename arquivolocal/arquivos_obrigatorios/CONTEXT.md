| 2026-03-15 | Barra de exclusão em massa (Excluir selecionados) agora ocupa toda a largura abaixo dos filtros, igual à imagem 2 enviada pelo usuário. |
| 2026-03-15 | Botão 'Excluir selecionados' movido para logo abaixo dos filtros, alinhado à direita, conforme layout solicitado pelo usuário. |
| 2026-03-15 | Ajuste visual: controles acima da tabela alinhados conforme layout do usuário (contador à esquerda, botão excluir à direita). |
| 2026-03-15 | Seleção em massa agora por checkbox em cada linha e no cabeçalho da tabela; botão 'Excluir selecionados' só aparece se houver seleção. |
| 2026-03-15 | Corrigido fluxo dos botões: 'Selecionar tudo' apenas seleciona, 'Excluir selecionados' abre modal de confirmação. Seleção em massa agora segue padrão esperado. |
| 2026-03-15 | Padronização do tipo Opcoes: uso de ccList (centros de custo) e nomes em todo o projeto; removidos centrosCusto/setores inconsistentes. |
| 2026-03-15 | Parser de data do Excel reforçado: aceita Date, string, serial e loga valores inesperados para debug. |
| 2026-03-15 | Importação de Excel: horaEntrada/horaSaida agora sempre no formato hh:mm:ss (sem data/timezone) na pré-visualização e persistência |
| 2026-03-15 | Tela principal: agrupamento por loteId removido, cada registro é exibido individualmente (inclusive importados do Excel) |
| 2026-03-16 | Adicionado botão 'Excluir TODOS' (admin-only) na tela principal, com modal de confirmação, log de auditoria e exclusão em massa dos registros. |
| 2026-04-04 | MobileLancamentosPage: adicionado botão 'Sair' no header (vermelho, chama supabase.auth.signOut()) |
| 2026-04-04 | AdminPage: usuários sem role admin redirecionados para / em vez de exibir tela 'Access Denied' (fix segurança A01) |
| 2026-04-04 | AdminPage: adicionado logAudit nas mutations approvalMutation, roleMutation, unblockMutation e permsMutation (OWASP A09) |
| 2026-04-04 | Index: tab inicial alterada de 'lancamentos' para 'dashboard'; botão Mobile adicionado no header |
| 2026-04-04 | Index: header alinhado com design mobile — background #212B36, page surface #FAF9FB, borders #2E3B4A, texto secundário #9898B0, Sair #EF4444 |
| 2026-04-04 | Index: verif. admin migrada para rpc('is_admin') (SECURITY DEFINER, fail-closed); ícones PNG no nav (dashboard.png, logo.png, admin.png) |
| 2026-04-04 | Index: PNG contextual no branding (quadrado logo) — dashboard.png na aba dashboard, logo.png nas demais; nav tabs voltam a usar SVG |
| 2026-04-20 | Ícones: todos os arquivos PNG em public/ substituídos por logo_terceiros.png ("C" laranja em círculo escuro); logo-192.png e logo-512.png regenerados nos tamanhos PWA |
| 2026-04-20 | feat(excedente): nova tabela turnos_capacidade; coluna Excedente na tela de lançamentos; seção Capacidade por Turno em Configurações (admin-only); botão Excedentes XLSX no fechamento |
| 2026-04-19 | Ícones: favicon.png substituído pelo novo ícone (pessoa + laranja); dashboard.png criado (estava ausente, causava imagem quebrada no header) |
| 2026-04-19 | PWA: adicionado vite-plugin-pwa + Workbox; manifest gerado com ícones 192/512; SW cacheia assets estáticos + NetworkOnly para Supabase (LGPD); CSP atualizada com worker-src 'self' no vercel.json |
| 2026-04-04 | Index: carrega whatsapp_template do banco ao iniciar (junto com dpo_nome/dpo_email); fix: template configurado pelo admin agora é aplicado sem precisar abrir Configurações |
| 2026-04-04 | ErrorBoundary: console.error protegido com guarda DEV para evitar vazamento de stack trace em produção (OWASP A05) |
# Controle de Terceiros — Contexto do Projeto

> **Última atualização:** 2026-04-22
> **Branch:** Main-terceiros

---

> ⚠️ **REGRA OBRIGATÓRIA PARA O COPILOT**
> Antes de **qualquer alteração de código** neste projeto, leia obrigatoriamente:
> 1. Este arquivo `arquivolocal/CONTEXT.md` — visão geral, schema, convenções e histórico
> 2. `arquivolocal/skill_tdd.md` — diretrizes de TDD obrigatórias para este projeto


---

## 1. Visão Geral

Sistema web para **controle de presença e gestão de trabalhadores terceirizados** em operações logísticas (cliente principal: Souza Cruz). Permite registrar entrada/saída, turno, cargo, setor, motivo de acionamento e fornecedor de mão de obra. Possui painel administrativo, conformidade com LGPD e trilha de auditoria completa.

---

## 2. Stack Tecnológica
> **Para criação de layouts e componentes, consulte sempre:**
> - https://ui.shadcn.com/
> - https://tailwindcss.com/

| Camada | Tecnologia |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Roteamento | React Router v6 |
| Estado | useState/useEffect (hooks customizados: useStorage, useOpcoes) |
| UI Components | shadcn/ui + Radix UI |
| Estilo | Tailwind CSS + inline styles (páginas principais) |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel |
| PWA | vite-plugin-pwa + Workbox (Service Worker, manifest, cache de assets) |
| Ícones | lucide-react |
| Sanitização | DOMPurify |

---

## 3. Estrutura de Pastas

```
src/
├── App.tsx                  # Roteamento principal + controle de sessão + ErrorBoundary (sem QueryClientProvider)
├── main.tsx                 # Entry point React
├── globals.css              # Estilos globais
├── components/
│   ├── atoms.tsx            # Átomos de UI: Icon, Chip, Input, Select, Btn, Modal, AutocompleteNome, G, LABEL_STYLE, BlockHeader
│   ├── PrivacyNotice.tsx    # usePrivacyAccepted() + PrivacyNotice (LGPD)
│   ├── FormLancamento.tsx   # Formulário de lançamento (PessoaRow, FormLancamento)
│   ├── Lancamentos.tsx      # Tab de lançamentos (tabela, filtros, modais)
│   ├── ImportRegistrosCsvModal.tsx # Modal isolado para importação de presenças via CSV com prévia
│   ├── Dashboard.tsx        # Tab de dashboard (KPIs, gráfico por fornecedor)
│   ├── Configuracoes.tsx    # Tab de configurações (opções, DPO, WhatsApp, admin)
│   ├── FechamentoTab.tsx    # Tab de fechamento financeiro por fornecedor/período
│   ├── ErrorBoundary.tsx    # Error Boundary global
│   └── ui/                  # Todos os componentes shadcn/ui (não editar)
├── hooks/
│   ├── useStorage.ts        # Hook persistência de registros no Supabase
│   ├── useOpcoes.ts         # Hook persistência de opções + terceiros; helper syncList()
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── use-i18n.ts          # Hook useI18n() para acesso ao contexto de idioma
├── lib/
│   ├── audit.ts             # uuid(), sanitize(), logAudit() — centralizados
│   ├── supabase.ts          # Client Supabase + authReady promise
│   ├── format-utils.ts      # Funções puras: calcHoras, fmt, fmtMes (Intl), dbToRegistro, etc.
│   ├── import-registros-csv.ts # Parser/normalizador/validador puro para importação de registros via CSV
│   ├── fechamento-utils.ts  # Lógica de fechamento financeiro; inclui TurnoCapacidade + mappers
│   ├── excedente-utils.ts   # Funções puras: resolverCapacidade, calcExcedentePorTurnoDia, gerarDadosRelatorioExcedentes
│   ├── projecao-utils.ts    # Funções puras: gerarDias(), calcMediaPorTurno(), calcDadosPorDia(), TURNOS_PROJECAO
│   ├── i18n-translations.ts # Traduções pt-BR/en-US + mapSupabaseError()
│   ├── i18n-context.ts      # React.createContext do sistema i18n
│   ├── i18n.tsx             # I18nProvider (componente de contexto)
│   ├── api/
│   │   └── fechamento-dashboard.ts # Fonte canônica do dashboard financeiro (somente fechamentos aprovados)
│   └── utils.ts             # cn() helper
├── pages/
│   ├── Index.tsx            # Orquestrador (~197L): apenas imports + componente Index
│   ├── MobileLancamentosPage.tsx # Versão mobile dos lançamentos
│   ├── ProjecaoPage.tsx     # Página de projeção/análise de demanda
│   ├── LoginPage.tsx        # Autenticação email/senha
│   ├── AdminPage.tsx        # Gerenciamento de usuários
│   ├── ResetPasswordPage.tsx
│   └── NotFound.tsx
├── types/
│   └── attendance.ts        # Interfaces: Registro, Opcoes, OPCOES_DEFAULT, SelectOption
supabase/
├── schema.sql               # Schema base completo
└── migrations/
    ├── admin_setup.sql
    ├── audit_log.sql
    ├── fechamento_tables.sql
    ├── fix_linter_warnings.sql
    ├── fix_rls_write_policies.sql
    ├── retention_policy.sql
    ├── terceiros_table.sql
    └── user_management.sql
supabase/functions/
└── admin-users/
    └── index.ts             # Edge Function: criar, editar, excluir usuários
arquivolocal/
├── TOTP_MELHORES_PRATICAS.md        # Boas práticas de TOTP e backup codes
└── GUIA_IMPLEMENTACAO_MFA_SUPABASE.md # Guia reutilizável para implementar MFA com Supabase
```

---

## 4. Banco de Dados (Supabase)

### Tabelas

| Tabela | Descrição |
|---|---|
| `registros` | Registros de presença dos terceirizados |
| `opcoes` | Listas de seleção configuráveis (chave/valor) |
| `terceiros` | Cadastro de nomes de colaboradores terceirizados |
| `profiles` | Perfis de usuário com is_admin, is_approved e custom_permissions |
| `user_roles` | Role RBAC por usuário (admin/moderator/user) |
| `audit_log` | Trilha de auditoria de operações |
| `turnos_capacidade` | Capacidade padrão por turno com período de vigência (admin-only write, authenticated read) |

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
id                 UUID  PK (FK → auth.users)
email              TEXT
is_admin           BOOLEAN  DEFAULT false
is_approved        BOOLEAN  DEFAULT true
custom_permissions TEXT[]   DEFAULT '{}'
created_at         TIMESTAMPTZ
```

### Schema `user_roles`

```sql
id         BIGINT  PK (identity)
user_id    UUID    FK → auth.users (UNIQUE)
role       app_role  ENUM ('admin', 'moderator', 'user')
created_at TIMESTAMPTZ  DEFAULT now()
```

> `app_role` é um enum PostgreSQL criado pela migration `rbac_approvals.sql`.
> Trigger `sync_is_admin_from_role` mantém `profiles.is_admin` sincronizado: `role='admin'` → `is_admin=true`.

### RLS — Políticas restritivas (2026-03-15)

- **diarias_config, fechamento_itens, fechamentos, terceiros, turnos_config**:
  - INSERT/UPDATE/DELETE: **apenas administradores** (`profiles.is_admin = true`)
  - SELECT: permanece liberado para autenticados
- Políticas antigas permissivas removidas (USING/`WITH CHECK (true)`)
- Migration: `fix_rls_admin_only.sql`

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
| `/login` | Público | `LoginPage` — inclui seletor de modo (mobile/desktop) salvo em sessionStorage |
| `/` | Autenticado | `Index` |
| `/mobile` | Autenticado | `MobileLancamentosPage` — versão mobile-first da tela de lançamentos |
| `/admin` | Autenticado | `AdminPage` |
| `/reset-password` | Aberto (requer token de recuperação) | `ResetPasswordPage` |
| `*` | Qualquer | `NotFound` |

---

## 6. Lógica de Negócio Principal (Index.tsx)


### Campos de Lançamento

| Campo            | Tipo         | Chave `opcoes` |
|------------------|-------------|----------------|
| Turno            | select      | `turnos`       |
| Unidade          | select      | `unidades`     |
| Fornecedor       | select      | `fornecedores` |
| Motivo           | select      | `motivos`      |
| Cargo            | select      | `cargos`       |
| Centro de Custo  | select      | `ccList`       |
| Nome             | autocomplete| `nomes`        |

> **Nota:** O projeto padroniza o uso de `ccList` para centros de custo e `nomes` para autocomplete de colaboradores. Não existe mais `centrosCusto` ou `setores` em Opcoes.

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
- Interface com **3 abas** via shadcn/ui Tabs:

### Aba Usuários
- Stats cards (total, admins, comuns)
- Barra de busca + toggle **Grid / Lista**
- **Grid:** cards por usuário com avatar, badge de role, Switch de aprovação, seletor de role, Criado em, botões Reset Senha e Excluir
- **Lista:** tabela compacta com os mesmos controles
- **Criar usuário:** AlertDialog com campos e-mail, senha e toggle admin
- **Excluir:** AlertDialog de confirmação (não pode excluir a si mesmo)
- **Reset de senha:** envia e-mail para `/reset-password` (mantém fluxo atual)
- Não permite alterar o próprio role

### Aba Permissões
- Coluna esquerda: lista de usuários selecionáveis
- Coluna direita: presets rápidos (user/moderator/admin) + checkboxes por categoria (Accordion) + botão salvar
- Permissões salvas em `profiles.custom_permissions TEXT[]`

### Aba Conta
- Alteração de senha do usuário logado via `supabase.auth.updateUser()`

### Roles disponíveis

| Role | Label | Presets de permissão |
|---|---|---|
| `admin` | Admin | Todas as permissões |
| `moderator` | Moderador | records.view/create/edit/export + projection.view |
| `user` | Usuário | records.view/create |

### Permissões do sistema

| Chave | Descrição |
|---|---|
| `records.view` | Ver registros |
| `records.create` | Criar lançamentos |
| `records.edit` | Editar / excluir |
| `records.export` | Exportar PDF/Excel |
| `records.close` | Fechar período |
| `projection.view` | Ver projeção |
| `admin.access` | Painel admin |

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
| `create` | `{ email, password, is_admin? }` — também insere em `user_roles` |
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
pnpm dev          # servidor de desenvolvimento
pnpm build        # build de produção
pnpm build:dev    # build em modo development
pnpm lint         # ESLint
pnpm preview      # preview do build
pnpm test         # executa todos os testes (Vitest)
pnpm test:watch   # testes em modo watch
```

### Regra de Testes

- **Antes de cada commit**, executar `pnpm test` e garantir que todos passem
- Testes ficam co-localizados: `src/**/*.test.ts`
- Framework: **Vitest** + **@testing-library/react** + **jsdom**
- Setup de testes: `src/test/setup.ts`
- Funções puras extraídas em `src/lib/format-utils.ts` para facilitar testes
- **Nunca commitar com testes falhando**

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
- `Index.tsx` — completa: PrivacyNotice, FormLancamento, Lancamentos, Dashboard, Configuracoes (incl. DPO e LGPD exclusão), FechamentoTab, navbar (Hoje/Mês/Admin/Sair/abas de navegação)

---

## 13. Convenções de Código

- Todo código fonte em `src/`
- Páginas em `src/pages/`, componentes em `src/components/`
- Path alias `@/` aponta para `src/`
- Usar shadcn/ui para componentes de UI — **não editar** arquivos em `src/components/ui/`
- Estilo: Tailwind CSS preferencialmente; inline styles usados nas páginas principais (Index, Login, Admin)
- Tipagem estrita: evitar `any`, usar `unknown` quando necessário
- Sanitizar entrada do usuário com `DOMPurify` antes de persistir (via `sanitize()` em Index.tsx)
- Error Boundary global (`ErrorBoundary.tsx`) envolve todo o app para prevenir tela branca

---

## 13. Dívida Técnica Identificada (2026-03-26)

Resultado da varredura de verbosidade e over-engineering realizada em 2026-03-26. Os itens abaixo estão classificados por prioridade e devem ser tratados antes de implementar novas funcionalidades.

| Prioridade | Localização | Problema | Ação Recomendada |
|---|---|---|---------|
| 🔴 Alta | `Index.tsx` (inteiro) | Monolith ~2700 linhas — hooks, UI e lógica de negócio no mesmo arquivo | Extrair `useStorage` e `useOpcoes` para `src/hooks/`; sub-componentes (`Lancamentos`, `Dashboard`, `FechamentoTab`, `Configuracoes`) para `src/components/` |
| 🟠 Média | `Index.tsx`: `useOpcoes.save()` | Lógica diff `toAdd`/`toRemove` duplicada para options e names | Extrair helper genérico `diffSyncItems(prev, next)` |
| 🟠 Média | `App.tsx` | `QueryClientProvider` configurado mas zero `useQuery`/`useMutation` em todo o projeto | Remover `QueryClientProvider` e dependência `@tanstack/react-query` |
| 🟠 Média | `Index.tsx`: `salvar()` | `registros.some()` com a mesma condição executado duas vezes | Extrair resultado para variável e reutilizar |
| 🟡 Baixa | `Index.tsx`: `FormLancamento` | `<G cols={1}>` — wrapper de grid de 1 coluna desnecessário | Remover `G` e usar o elemento filho diretamente |
| 🟡 Baixa | `Index.tsx` (~30 ocorrências) | Inline label styles com os mesmos 5 atributos repetidos | Extrair constante `labelStyle` |
| 🟡 Baixa | `Index.tsx` (4 ocorrências) | Block header badge (div numerada) duplicada 4× | Extrair componente `BlockHeader` |
| 🟡 Baixa | `Index.tsx`: `Btn` component | Variante `outline` definida mas nunca usada em lugar nenhum | Remover variante ou aplicá-la onde fizer sentido |
| 🟡 Baixa | `src/lib/format-utils.ts`: `fmtMes` | Array manual de meses pt-BR em vez de API nativa | Substituir por `Intl.DateTimeFormat` com `{ month: 'long' }` |

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
| 2026-03-14 | Refatoração responsiva global: movidos todos os media queries (rsp-*) para globals.css (fonte única de verdade); removidos estilos CSS duplicados das <style> embutidas em Index.tsx, AdminPage.tsx, LoginPage.tsx e ResetPasswordPage.tsx; adicionado rsp-modal-grid nos grids de detalhe dentro de Modais; LoginPage e ResetPasswordPage cobertas pelo @keyframes e rsp-auth-card globais |
| 2026-03-14 | Melhoria de responsividade em cards e grids para telas pequenas: filtros de Lançamentos usam flex grow (flex:1 1 120px) em vez de width fixo; grid de Fornecedores e Configurações recebem classe rsp-grid-autofill para coluna única ≤640px; stat interna dos cards Fornecedores usa rsp-grid-3; modal detalhe-lote com overflowX:auto e minWidth:380; botões do form com flexWrap; barra de busca AdminPage flexível |
| 2026-03-14 | Revertido filtros de Lançamentos para width fixo original (150/180px) a pedido do usuário |
| 2026-03-14 | CRUD completo para todas as opções do app (Configurações): cada card de opção (turnos, unidades, fornecedores, motivos, cargos, CC, setores) agora tem busca/filtro, edição inline (renomear com propagação automática para registros existentes no DB), remoção, adição, e importação em massa; seção de Nomes também recebe edição inline; função importItems unificada para todas as categorias; mapeamento KEY_TO_FIELD para atualizar registros no rename; novos i18n keys (cfg_opt_search, cfg_opt_import_*, cfg_opt_rename_dup, cfg_opt_used_in) |
| 2026-03-14 | Nomes removidos da tabela opcoes: SELECT filtra chave='nomes', limpeza automática de dados residuais no carregamento; nomes existem apenas na tabela terceiros |
| 2026-03-14 | Importação em massa unificada: campo único com seletor de categoria (Colaboradores, Turnos, Unidades, Fornecedores, Motivos, Cargos, CC, Setores) substitui importação individual por card; removidos botões de importação dos cards de opções; i18n atualizado com labels genéricos |
| 2026-03-14 | Corrigido RLS: adicionadas políticas SELECT para role authenticated nas tabelas registros e opcoes; sem elas, upserts falhavam porque o Supabase precisa de SELECT para verificar conflitos (onConflict) |
| 2026-03-14 | Infraestrutura de testes: Vitest + @testing-library/react + jsdom; funções puras extraídas de Index.tsx para src/lib/format-utils.ts; 35 testes cobrindo calcHoras, fmt, fmtMes, fornCor, dbToRegistro, registroToDb, dataLimiteRetencao, KEY_TO_FIELD e mapSupabaseError; regra de testes obrigatórios antes de commit adicionada às instruções do Copilot |
| 2026-03-15 | Seções DPO (Art. 41) e Exclusão por Solicitação (Art. 18 LGPD) SEMPRE visíveis para administradores na aba Configurações, independentemente de estado de sessão/isAdmin |
| 2026-03-14 | Implementado componente FechamentoTab: cálculo de fechamento financeiro por fornecedor/período com filtros (mês, período 1º/2º/3º/custom, fornecedor), resumo (presenças, horas, total), tabela detalhada por pessoa/dia com edição inline de valores, fluxo de status (rascunho→enviado→revisão→aprovado), salvar/carregar do DB (fechamentos + fechamento_itens), exportação XLSX, histórico de fechamentos salvos |
| 2026-03-14 | Removido bloco "Resumo por pessoa" do FechamentoTab (redundante com tabela detalhada); adicionada exportação PDF (jspdf + jspdf-autotable) com tabela completa e rodapé de total |
| 2026-03-14 | Removido card "HORAS" do resumo do FechamentoTab (redundante com a tabela detalhada) |
| 2026-03-15 | Integração WhatsApp via Evolution API: Edge Function send-whatsapp, painel de config em Configurações (admin), hook fire-and-forget em salvar(); chaves wpp_enabled/wpp_url/wpp_instance/wpp_key/wpp_group_id salvas na tabela opcoes |
| 2026-03-15 | Remove integração WhatsApp completa (Edge Function send-whatsapp, estados e UI em Index.tsx, chamada em salvar()) |
| 2026-03-15 | Renomeada coluna "Dif." para "Diferença" na tabela de fechamento (i18n pt-BR) |
| 2026-03-14 | Adicionada coluna "Dif." na tabela de fechamento mostrando valorCalculado - valorDiaria, colorida em vermelho (negativo), verde (positivo) ou cinza (zero); exportações XLSX e PDF também incluem a coluna |
| 2026-03-14 | Validação de duplicidade no FormLancamento: ao salvar, verifica se já existe registro com mesmo nome + mesma data; se sim, bloqueia, mantém modal aberto e exibe aviso com opção de confirmar mesmo assim (force=true) |
| 2026-03-14 | Corrigida detecção de duplicatas no FormLancamento: adicionada verificação de nomes repetidos dentro do próprio lote (intra-lote) antes da verificação contra o banco; mensagem e botões de aviso diferenciados por tipo (interna vs banco); duplicata interna não permite confirmar mesmo assim |
| 2026-03-14 | Reforçada validação de duplicatas: comparação agora é case-insensitive em ambas as checagens (intra-lote e banco); corrigido bug defensivo em isEdit quando loteInicial e inicial coexistem; adicionada salvaguarda dupla no salvar() de Lancamentos que filtra duplicatas mesmo se handleSave falhar; regra de clarificação adicionada às instruções do Copilot |
| 2026-03-14 | Proteção anti-duplicata em 4 camadas: (1) handleSave verifica single-edit contra banco (antes não havia checagem); (2) salvar() agora deduplica também no branch de lote-edit; (3) useStorage.save() filtra duplicatas intra-lote antes de enviar ao Supabase; (4) migration fix_duplicate_lote_registros.sql remove duplicatas existentes no DB e adiciona UNIQUE INDEX em (lote_id, lower(nome)) |
| 2026-03-15 | Validação de duplo turno: mesmo nome no mesmo dia em turno diferente exige justificativa obrigatória; aviso amarelo com textarea; botão "Confirmar com justificativa" só habilitado após digitar motivo; justificativa salva no campo obs com prefixo [DUPLO TURNO] para uso no fechamento |
| 2026-03-15 | Refatoração: validação de turno diferente movida do FormLancamento para salvar() em Lancamentos (ponto de passagem único); conflito de turno agora é detectado pelo componente-pai que tem acesso direto ao state `registros` (sem prop stale); modal de conflito é renderizado por Lancamentos com textarea e botão bloqueado até justificativa; regra de proatividade em bugs recorrentes adicionada ao copilot-instructions.md |
| 2026-03-15 | Removida aba/tela Fornecedores de Index.tsx (irrelevante); removidas chaves i18n forn_* e nav_tab_forn; removido tipo TabId "fornecedores" |
| 2026-03-15 | Análise de Demanda (DemandAnalysis) acoplada ao Dashboard: tabela de valor por dia + tabela de presenças por turno (1ª/2ª/3ª); filtros por fornecedor, mês e range de datas; resumo estatístico (média/dia e média por turno); projeção manual com entradas fictícias para simular demanda futura; usa resolverDiaria para valores variáveis por fornecedor/turno; 27 chaves i18n (demand_*) em pt-BR e en-US |
| 2026-03-15 | Refatoração da projeção de demanda: substituída projeção manual (entradas fictícias) por projeção futura automática — usuário seleciona range de datas futuro e o sistema calcula automaticamente a demanda projetada com base na média geral histórica por turno (independente do dia da semana); dias projetados exibidos nas tabelas com badge "projeção" e fundo amarelo; mostra médias históricas utilizadas por turno |
| 2026-03-15 | Projeção de demanda: adicionado campo "Pessoas/dia" na projeção futura — quando preenchido, distribui o total informado proporcionalmente entre os 3 turnos com base na proporção histórica (ex: se 1ª=40%, 2ª=35%, 3ª=25% e total=20, fica 8/7/5); quando vazio, usa médias históricas brutas; auto-swap de datas invertidas; médias calculadas sobre todo o histórico (não só mês filtrado) |
| 2026-03-15 | Extraída Análise de Demanda (DemandAnalysis) do Dashboard para página dedicada ProjecaoPage.tsx com aba própria "Projeção" na navegação; Dashboard agora não exibe mais a seção de demanda; componente totalmente autônomo com filtros, tabelas, projeção e distribuição proporcional |
| 2026-03-15 | Importação de histórico via Excel: componente ImportExcelRegistros na aba Configurações; upload drag-and-drop de .xlsx; mapeamento automático de colunas (DATA_PRESENCA, TURNO, NOME_COMPLETO_TERCEIRO, etc.); detecção de duplicatas (nome+data+turno); pré-visualização; sanitização via DOMPurify; suporte a datas DD/MM/YYYY e serial Excel; 17 chaves i18n (imp_*) em pt-BR/en-US |
| 2026-03-15 | Corrigidas políticas SELECT: agora apenas usuários autenticados podem consultar diarias_config, fechamento_itens, fechamentos, opcoes, profiles, registros, terceiros e turnos_config (migration fix_rls_select_authenticated.sql) |
| 2026-03-24 | ProjecaoPage: tabelas "Média por Dia" e "Média por Turno" unificadas em uma única tabela full-width com colunas DATA / 1º / 2º / 3º / TOTAL / VALOR APROXIMADO; cálculo de valor incorporado (resolverDiaria por turno quando fornecedor filtrado, ou total×R$250 como fallback) |
| 2026-03-24 | Segurança: campo `nome` agora sanitizado com DOMPurify (ALLOWED_TAGS:[]) antes de persistir no Supabase, tanto no fluxo de edição individual quanto no fluxo de lote; CONTEXT.md corrigido removendo referência incorreta ao ImportExcelRegistros.tsx (componente nunca implementado) |
| 2026-03-24 | RBAC completo na AdminPage: migration rbac_approvals.sql adiciona enum app_role, tabela user_roles, colunas is_approved e custom_permissions em profiles, trigger sync_is_admin_from_role; AdminPage reescrita com 3 abas (Usuários/Permissões/Conta), grid/list view toggle, Switch de aprovação, seletor de role, AlertDialogs para criar/excluir, aba de permissões com Accordion + checkboxes + presets, shadcn/ui Tabs/Card/Switch/Select/Badge/Checkbox/Accordion/AlertDialog |
| 2026-03-24 | Auditoria de segurança OWASP Top 10:2025: adicionado header HSTS (max-age=31536000; includeSubDomains; preload) no vercel.json; dependências atualizadas: vite 6.3.6, react-router-dom 6.30.1 (fix XSS Open Redirect), jspdf 4.2.1 (fix HTML Injection + PDF Object Injection críticos), dompurify 3.3.3 (fix XSS moderado); vulnerabilidades reduzidas de 26 para 18 (eliminada 1 crítica); xlsx 0.18.5 sem patch público disponível (mitigado: restrito a admins autenticados) |
| 2026-03-24 | MFA (TOTP) implementado no frontend: LoginPage exibe challenge TOTP pós-login quando usuário tem fator inscrito (supabase.auth.mfa.challenge + verify, estado step mfa/login); AdminPage aba Conta ganha seção de enrollment (QR code, chave manual, confirmação de código) e unenrollment via supabase.auth.mfa.enroll/unenroll/listFactors; TOTP previamente ativado no Supabase dashboard |
| 2026-03-24 | Auditoria de erros silenciosos: corrigidos 33+ padrões em 8 arquivos (supabase.ts, App.tsx, main.tsx, Index.tsx, AdminPage.tsx, LoginPage.tsx, ResetPasswordPage.tsx, ProjecaoPage.tsx); todas as queries agora destructuram `{ error }` e exibem toast/console.error; promises encadeadas com `.catch()`; admin button fix: query profiles agora usa `.eq("id", session.user.id)` explícito em vez de depender somente de RLS; handler global `unhandledrejection` adicionado em main.tsx como safety net |
| 2026-03-24 | Migração de Edge Function para Vercel API Route: criado api/admin-users.ts (Vercel Serverless Function Node.js) que replica as ações create/update/delete da Edge Function do Supabase; usa SUPABASE_SERVICE_ROLE_KEY do servidor para autenticar (auth.getUser) e executar operações admin; deployado automaticamente a cada git push sem necessidade de CLI do Supabase; callAdminFn em AdminPage.tsx atualizado para chamar /api/admin-users (mesmo domínio, sem CORS); instalado @vercel/node como devDependency |
| 2026-03-24 | Varredura milimétrica de segurança e confiabilidade: (1) validação de formato de email adicionada em api/admin-users.ts antes de criar usuário; (2) CSP no vercel.json removeu 'wasm-unsafe-eval' não necessário em produção (Vite/SWC compila em build-time, não no browser); (3) função csvSafe melhorada para tratar CSV injection com quote + apóstrofo em todos os campos perigosos; (4) migration performance_indexes.sql com índices em registros(data,turno), registros(fornecedor), registros(unidade), registros(nome_trgm), opcoes(chave), terceiros(nome_tsv), audit_log(tabela,operacao,created_at); (5) migration fix_is_admin_null_guard.sql protege is_admin() contra auth.uid() NULL com CASE WHEN explícito |
| 2026-03-25 | Compartilhamento via WhatsApp: (1) função buildWhatsAppMessage em format-utils.ts monta mensagem formatada (individual ou lote) com campos configuráveis e labels em pt-BR; (2) WhatsAppTemplate armazenado na tabela opcoes (chave whatsapp_template, valor JSON com header + campos); (3) seção "Template WhatsApp" no Configurações com checkboxes dos 12 campos disponíveis, input de título, preview live da mensagem e botão salvar; (4) botão verde WhatsApp no modal de detalhe de registros (individual e lote) abre wa.me com mensagem pré-formatada via URL; (5) 9 testes unitários para buildWhatsAppMessage |
| 2026-03-25 | Agrupamento por loteId restaurado na tabela de Lançamentos: registros do mesmo lote voltam a ser exibidos em linha única com badge N×, nomes dos demais colaboradores abaixo e borda azul à esquerda; checkbox da linha seleciona/desseleciona todos os IDs do lote de uma vez |
| 2026-03-25 | Agrupamento da tabela de Lançamentos alterado de loteId para data+turno: registros do mesmo dia e turno agrupados em uma única linha independente de terem sido lançados em sessões separadas; useMemo grupos usa chave composta "data||turno" |
| 2026-03-25 | Mensagem WhatsApp: removida seta (→) entre horas de entrada e saída; novo formato: "HH:MM - HH:MM" quando ambas existem, só a hora quando apenas uma estiver preenchida; testes atualizados em format-utils.test.ts |
| 2026-03-25 | Mensagem WhatsApp: removidos emojis 📋 e 👥 do texto gerado; header e seção de colaboradores ficam somente em negrito (formato *texto*) sem ícones |
| 2026-03-25 | Editar Lote: controle de quantidade de pessoas (botões −/+) exibido também no modo de edição de lote; novas linhas herdam horaEntrada e horaSaida padrão do formulário; nomes buscados via autocomplete de terceiros cadastrados; IDs novos recebem uuid() automaticamente ao salvar |
| 2026-03-25 | Modo mobile: seletor de dispositivo (cards 📱 Mobile / 💻 Desktop) adicionado ao LoginPage antes do formulário de login; escolha salva em sessionStorage("deviceMode"); App.tsx detecta transição null→session e redireciona para /mobile ou / conforme o valor; nova página MobileLancamentosPage (src/pages/MobileLancamentosPage.tsx) com header fixo, filtros colapsáveis, lista de cards agrupados por data+turno, seleção em massa, FAB +, bottom sheet com Editar/Excluir/WhatsApp, reutiliza FormLancamento exportado de Index.tsx; Opcoes exportada de Index.tsx |
| 2026-03-25 | Layout mobile: alternador PT/EN no header mobile; override CSS de Colaboradores no modal mobile (.mobile-form-worker-grid/header/outer) para layout vertical empilhado; autocomplete de nome usa position:fixed (viewport) sem scroll horizontal |
| 2026-03-25 | Reorganização do FormLancamento: (1) CARGO movido de campo global do Bloco 1 para campo individual por pessoa no Bloco 5 (PessoaRow ganha campo cargo; handleQtd/handleSave/onSave use p.cargo); (2) Bloco JORNADA simplificado com apenas DATA + TURNO (removidos ENTRADA PADRÃO e SAÍDA PADRÃO — preenchimento automático de horas por turnosConfig mantido); Jornada movida para acima de Quantidade de Pessoas; (3) MOTIVO renomeado para OPERAÇÃO em todo o app (i18n: form_label_motivo, lanc_col_motivo, detail_motivo, cfg_opt_motivos, form_block_4; CSV header); campo OPERAÇÃO movido do Bloco 4 para o Bloco 1 (Identificação) ao lado de Fornecedor; Bloco 4 fica apenas OBSERVAÇÕES; CSS mobile atualizado com regra select para CARGO por pessoa |
| 2026-03-25 | Fusão dos blocos IDENTIFICAÇÃO e LOTAÇÃO: Bloco LOTAÇÃO removido; bloco IDENTIFICAÇÃO (badge 2) absorve todos os 4 campos na ordem FORNECEDOR | UNIDADE | OPERAÇÃO | CC (G cols=4); badges renumerados: JORNADA→1, IDENTIFICAÇÃO→2, OBSERVAÇÕES→3, COLABORADORES→4; melhorias WhatsApp: nomes convertidos para Title Case (split por espaço — compatível com acentos pt-BR), separador nome→hora alterado de " — " para ": " (ex: "Alam Vilas Boas: 13:40"), label "Motivo" → "Operação" em WHATSAPP_FIELDS na mensagem gerada |
| 2026-03-25 | Fix componente G movido para escopo de módulo (fora de FormLancamento) — corrige perda de foco ao digitar nos campos de texto (OBSERVAÇÃO etc.) |
| 2026-03-25 | WhatsApp: (1) corrigido bug em que OBSERVAÇÃO nunca aparecia na mensagem — saveWaTemplate agora também chama setWaTemplate(payload); (2) reordenação drag-and-drop dos campos: campos habilitados exibidos primeiro com handle ⠿, arrastáveis entre si; ordem salva no template e refletida no corpo da mensagem |
| 2026-03-25 | CONTEXT.md: adicionada regra obrigatória para o Copilot ler CONTEXT.md e arquivolocal/skill_tdd.md antes de qualquer alteração de código |
| 2026-03-26 | Análise de verbosidade e over-engineering em Index.tsx: 9 achados catalogados na Seção 13 — monolith ~2700 linhas, QueryClientProvider sem uso, lógica duplicada em useOpcoes, double traversal em salvar(), estilos inline repetidos, G cols=1 desnecessário, BlockHeader duplicado 4×, Btn outline sem uso, fmtMes com array manual |
| 2026-03-26 | Fix 1: Index.tsx reduzido de 2629 → 197 linhas; extraídos para módulos: useStorage (hooks/), useOpcoes (hooks/), PrivacyNotice (components/), atoms (components/), FormLancamento (components/), Lancamentos (components/), Dashboard (components/), Configuracoes (components/), FechamentoTab (components/); audit centralizado em lib/audit.ts; Opcoes + OPCOES_DEFAULT em types/attendance.ts; Fix setWaTemplate bug (agora prop explícita no Configuracoes) |
| 2026-03-26 | Fix 2: helper syncList() em useOpcoes.ts elimina duplicação da lógica de diff (toAdd/toRemove/upsert/delete) usada para opcoes e terceiros |
| 2026-03-26 | Fix 3: QueryClientProvider e queryClient removidos de App.tsx — dependência @tanstack/react-query estava instalada mas nunca usada |
| 2026-03-26 | Fix 4: findConflitoDeTurno() extraída como helper de módulo em Lancamentos.tsx — substitui inline registros.find() repetido |
| 2026-03-26 | Fix 6+7: LABEL_STYLE constant + BlockHeader component adicionados a atoms.tsx; Input/Select usam LABEL_STYLE; Dashboard, Lancamentos, FechamentoTab e Configuracoes usam BlockHeader |
| 2026-03-26 | Fix 9: fmtMes() em format-utils.ts reescrita usando Intl.DateTimeFormat — elimina array manual de meses português; todos os 87 testes passando |
| 2026-04-03 | Substituída biblioteca xlsx (CVE sem patch) por exceljs 4.4.0; export XLSX em FechamentoTab.tsx migrado para API exceljs (writeBuffer+Blob); vite.config.ts atualizado |
| 2026-04-03 | ProjecaoPage.tsx: removida interface Opcoes local duplicada; importa tipo compartilhado de @/types/attendance |
| 2026-04-03 | Extraídas funções puras de projeção para src/lib/projecao-utils.ts: gerarDias(), calcMediaPorTurno(), calcDadosPorDia(), TURNOS_PROJECAO; ProjecaoPage refatorada para usar as funções |
| 2026-04-03 | Adicionados testes unitários em projecao-utils.test.ts (12 casos) e smoke test em MobileLancamentosPage.test.tsx (3 casos); total: 162 testes passando |
| 2026-04-01 | Restaurado Index.tsx ao estado slim (~176 linhas) após regressão git: corrigido crash "Algo deu errado" (Dashboard usado sem import → ReferenceError), corrigida regressão visual do header (dark navy #0B1628 → branco #fff, azul → laranja #F37E38), removidos todos os componentes e hooks inline duplicados (useStorage, useOpcoes, PrivacyNotice, atoms, FormLancamento, FechamentoTab), adicionados imports corretos dos módulos externos; 148 testes passando |
| 2026-04-18 | Adicionado guia reutilizável arquivolocal/GUIA_IMPLEMENTACAO_MFA_SUPABASE.md com setup de MFA TOTP em Supabase, cobrindo enrollment, login MFA, backup codes, AAL2 em RLS e checklist de produção |
| 2026-04-06 | Dashboard.tsx alinhado ao DESIGN.md: removidos borders proibidos (No-Line Rule), cores mapeadas para CSS variables de surface, fontes Space Grotesk/Plus Jakarta Sans/Inter, padding 6rem, elevação tonal com ambient shadow; tokens adicionados em globals.css e tailwind.config.ts; Google Fonts preload em index.html |
| 2026-04-06 | Conformidade TOTP: migration backup_codes.sql (tabela + RLS + RPC use_backup_code); MfaSetupPage exibe 10 backup codes após enrollment (copiar/baixar); LoginPage com rate limit TOTP (5 falhas/60s), fluxo de recuperação por backup code, logAudit em 5 eventos MFA, aria-label e placeholder corrigidos; tipos MFA adicionados em audit.ts |
| 2026-04-06 | fix_audit_log_constraint.sql: adicionados 5 tipos MFA na constraint CHECK (MFA_ENROLL, MFA_VERIFY, MFA_SKIP, MFA_VERIFY_FAIL, BACKUP_CODE_USED) — corrige 400 Bad Request no audit_log |
| 2026-04-19 | feat(diarias): vigência de período em diarias_config — migration diarias_config_add_vigencia.sql (ADD vigencia_inicio/fim DATE, DROP UNIQUE fornecedor+turno); DiariaConfig interface atualizada; resolverDiaria prioriza config c/ vigência válida sobre sem período; calcularValorDia e gerarItensFechamento passam data; Dashboard.tsx e ProjecaoPage.tsx passam r.data/dia; Configuracoes.tsx: insert em vez de upsert, campos De/Até no formulário, coluna Vigência na tabela; 7 novos testes — total 189 passando |
| 2026-04-22 | ResetPasswordPage: logo do topo atualizada para reutilizar o asset logo.png (C laranja) no lugar do SVG de caminhão, alinhando o branding da recuperação de senha ao header principal do app |
| 2026-04-25 | Dashboard financeiro passa a buscar apenas itens de fechamentos aprovados canônicos por fornecedor/período (src/lib/api/fechamento-dashboard.ts), corrigindo divergência de custo por fornecedor e total geral; adicionados testes de regressão (3440/3544) |
| 2026-04-25 | Importação de presença via CSV em Lançamentos: modal isolado (ImportRegistrosCsvModal), parser puro em src/lib/import-registros-csv.ts com validação/deduplicação/conflito de turno, integração admin-only no botão "Importar CSV" e testes unitários da importação |
