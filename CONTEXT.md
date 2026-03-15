# Controle de Terceiros — Contexto do Projeto

> **Última atualização:** 2026-03-14
> **Branch:** Main-terceiros

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
├── App.tsx                  # Roteamento principal + controle de sessão + ErrorBoundary
├── main.tsx                 # Entry point React
├── globals.css              # Estilos globais
├── components/
│   ├── ErrorBoundary.tsx    # Error Boundary global (previne tela branca em crash)
│   ├── ImportExcelRegistros.tsx  # Importação de histórico Excel para registros
│   └── ui/                  # Todos os componentes shadcn/ui
├── hooks/
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── use-i18n.ts            # Hook useI18n() para acesso ao contexto de idioma
├── lib/
│   ├── supabase.ts            # Client Supabase + authReady promise
│   ├── format-utils.ts        # Funções puras: calcHoras, fmt, fmtMes, dbToRegistro, etc.
│   ├── fechamento-utils.ts    # Lógica de fechamento financeiro
│   ├── i18n-translations.ts   # Traduções pt-BR/en-US + mapSupabaseError()
│   ├── i18n-context.ts        # React.createContext do sistema i18n
│   ├── i18n.tsx               # I18nProvider (componente de contexto)
│   └── utils.ts               # cn() helper
├── pages/
│   ├── Index.tsx              # Página principal (lançamento + listagem)
│   ├── ProjecaoPage.tsx       # Página dedicada de projeção/análise de demanda
│   ├── LoginPage.tsx          # Autenticação email/senha
│   ├── AdminPage.tsx          # Gerenciamento de usuários + conta
│   ├── ResetPasswordPage.tsx  # Redefinição de senha
│   └── NotFound.tsx
├── types/
│   └── attendance.ts          # Interfaces: Registro, SelectOption
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
