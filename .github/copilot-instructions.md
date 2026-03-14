# Instruções do GitHub Copilot — Controle de Terceiros

## Regra Principal: Atualizar CONTEXT.md

**Sempre que fizer qualquer alteração no projeto** (nova funcionalidade, nova rota, novo componente, mudança de banco de dados, nova dependência, alteração de lógica, etc.), você **deve atualizar o arquivo `CONTEXT.md`** na raiz do repositório.

### O que atualizar no CONTEXT.md

- **Seção 3 (Estrutura de Pastas):** adicione novos arquivos/pastas criados
- **Seção 4 (Banco de Dados):** atualize se houver novas tabelas, colunas, índices ou políticas RLS
- **Seção 5 (Autenticação):** atualize se mudar o fluxo de login, rotas protegidas, etc.
- **Seção 6 (Lógica de Negócio):** atualize campos, valores default, lógica de lançamento ou hooks
- **Seção 7 (LGPD):** atualize se mudar prazo de retenção, campos coletados ou base legal
- **Seção 8 (Admin):** atualize se adicionar abas ou funcionalidades ao AdminPage
- **Seção 9 (Variáveis de Ambiente):** adicione novas env vars
- **Seção 10 (Comandos):** atualize se adicionar scripts no package.json
- **Seção 11 (Convenções):** atualize se adotar novos padrões de código
- **Seção 12 (Histórico):** sempre adicione uma linha no formato `| YYYY-MM-DD | Descrição da alteração |`

### Formato da entrada no histórico

```markdown
| 2026-03-14 | Descrição curta do que foi alterado |
```

---

## Regra de Commit

**Após cada alteração no projeto** (incluindo a atualização do `CONTEXT.md`), você **deve realizar um commit** com todos os arquivos modificados.

### Formato da mensagem de commit

Use o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo>): <descrição curta em português>
```

**Tipos permitidos:**

| Tipo | Uso |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `style` | Alterações de estilo/CSS sem lógica |
| `chore` | Atualização de deps, configs, scripts |
| `docs` | Alterações apenas em documentação |
| `db` | Migração ou alteração de schema no Supabase |

**Exemplos:**

```
feat(auth): adiciona rota dedicada /reset-password
fix(index): corrige cálculo de horas para turnos noturnos
db(migrations): adiciona coluna observacao na tabela registros
docs(context): atualiza CONTEXT.md com novo schema
```

### Sequência obrigatória ao final de cada tarefa

1. Atualizar `CONTEXT.md` (seções relevantes + histórico)
2. Executar o commit com **todos** os arquivos alterados:

```bash
git add -A && git commit -m "tipo(escopo): descrição"
```

---

## Tech Stack

- React 18 + TypeScript + Vite
- React Router v6 (rotas em `src/App.tsx`)
- TanStack React Query v5
- shadcn/ui + Radix UI + Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS)
- Deploy: Vercel

## Regras de Código

- Código fonte em `src/`, páginas em `src/pages/`, componentes em `src/components/`
- Path alias `@/` → `src/`
- **NÃO editar** arquivos em `src/components/ui/` (shadcn/ui gerados)
- Criar novos componentes ao invés de modificar shadcn
- Tailwind CSS para estilo; inline styles aceitos nas páginas principais
- Evitar `any`; usar `unknown` quando necessário
- Sanitizar entrada do usuário com `DOMPurify` antes de persistir
- Sempre aguardar `authReady` antes de operações de escrita no Supabase
- Log de auditoria obrigatório para INSERT, UPDATE, DELETE, PURGE

## Estrutura de Rotas

| Rota | Componente |
|---|---|
| `/login` | `LoginPage` |
| `/` | `Index` (página principal) |
| `/admin` | `AdminPage` |
| `*` | `NotFound` |

## Banco de Dados Principal

Tabelas: `registros`, `opcoes`, `terceiros`, `profiles`, `audit_log`

Consulte `CONTEXT.md` para o schema completo e políticas RLS.
