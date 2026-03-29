# Instruções do GitHub Copilot — Controle de Terceiros

## Regra de Clarificação (OBRIGATÓRIA)

** Leia CONTEXT.md antes de qualquer implementação. Ele contém o contexto completo do projeto, incluindo estrutura, banco de dados, autenticação, lógica de negócio, LGPD, admin, variáveis de ambiente, comandos e convenções.

** Leia skill_tdd.md para entender o processo recomendado de desenvolvimento orientado a testes (TDD) e como ele se encaixa no fluxo de trabalho.

** leia skill_seguranca-webapp.md para entender as melhores práticas de segurança específicas para aplicações web, incluindo autenticação, autorização, proteção contra ataques comuns e conformidade com LGPD.

** leia DESIGN.md para entender as diretrizes de design do projeto, incluindo padrões de interface, componentes reutilizáveis e consistência visual.

**Antes de iniciar qualquer tarefa**, sempre pergunte ao usuário o que pode ajudar a entender melhor o que está sendo pedido. Exemplos de perguntas úteis:

- "Essa ação foi feita pelo formulário ou por importação de arquivo?"
- "Isso aconteceu antes ou depois do último deploy?"
- "Isso afeta só a tela X ou outras partes do app também?"
- "Tem um exemplo visual (screenshot) ou mensagem de erro que posso ver?"
- "Isso deve funcionar apenas para novos dados ou também corrigir dados existentes?"

Não assuma o contexto — **pergunte primeiro, implemente depois**.

---

## Regra de Proatividade em Bugs Recorrentes (OBRIGATÓRIA)

Quando o usuário relatar que um bug **se repetiu após um fix**, **não tente corrigir pelo mesmo caminho**. Siga este protocolo:

1. **Assuma que a abordagem anterior falhou estruturalmente** — não adicione mais código no mesmo ponto.
2. **Mude o ponto de validação**: se a validação estava no componente-filho (ex: `FormLancamento`), mova para o componente-pai que controla o `save` (ex: `salvar()` em `Lancamentos`).
3. **Adicione defesa em profundidade**: valide na camada mais próxima da persistência (a função que chama `setRegistros`), não na UI que pode ter estado stale.
4. **Se falhar pela 2ª vez no mesmo bug**, tente abordagem completamente diferente (ex: DB trigger, middleware, interceptor na camada de storage).
5. **Nunca espere o erro se repetir** — após implementar, faça build/compile check para garantir que o código funciona.

---

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
| `test` | Adição ou alteração de testes |

**Exemplos:**

```
feat(auth): adiciona rota dedicada /reset-password
fix(index): corrige cálculo de horas para turnos noturnos
db(migrations): adiciona coluna observacao na tabela registros
docs(context): atualiza CONTEXT.md com novo schema
```

### Sequência obrigatória ao final de cada tarefa

1. Atualizar `CONTEXT.md` (seções relevantes + histórico)
2. **Executar o build de produção** (`pnpm build`) — captura erros esbuild/Vite que o tsc não detecta
3. **Executar os testes** (`pnpm test`) e garantir que todos passem
4. Executar o commit e o push com **todos** os arquivos alterados:

```bash
pnpm build && pnpm test && git add -A && git commit -m "tipo(escopo): descrição" && git push
```

---

## Regra de Testes

**Antes de cada commit**, os testes automatizados devem ser executados e todos devem passar.

### Diretrizes

- Testes unitários ficam em `src/**/*.test.ts` (co-localizados com o módulo testado)
- Usar **Vitest** como framework de testes e **@testing-library/react** para componentes
- Funções de lógica pura devem estar em módulos utilitários (`src/lib/`) para facilitar testes
- Ao criar nova lógica de negócio (cálculos, formatação, mapeamento, validação), **criar testes correspondentes**
- Rodar `pnpm build` antes de commitar; se falhar, **corrigir antes de prosseguir**
- Rodar `pnpm test` antes de commitar; se falhar, **corrigir antes de prosseguir**
- **Nunca commitar com build ou testes falhando**

### Comandos

| Comando | Uso |
|---|---|
| `pnpm build` | Executa o build de produção (esbuild/Vite) |
| `pnpm test` | Executa todos os testes uma vez |
| `pnpm test:watch` | Executa testes em modo watch |

---

## Tech Stack

- React 18 + TypeScript + Vite
- React Router v6 (rotas em `src/App.tsx`)
- TanStack React Query v5
- shadcn/ui + Radix UI + Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS)
- Vitest + @testing-library/react (testes)
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
