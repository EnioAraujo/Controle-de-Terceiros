# Plano — Página Fornecedores

> Observação: o plan mode permite gravar apenas neste caminho. Após aprovação, este arquivo pode ser copiado para `arquivolocal/PLANO_PAGINA_FORNECEDORES.md` conforme solicitado.

## Contexto

Hoje todos os usuários autenticados enxergam todos os registros e todos os terceiros. A spec exige que cada fornecedor cadastre/edite **apenas seus próprios funcionários** via página dedicada (desktop e mobile). Os dados alimentam o dropdown de nomes em `FormLancamento`, que já filtra por fornecedor selecionado — então a integração final é transparente.

Decisões já consolidadas em `arquivolocal/PAGINA FORNECEDORES.md`:

1. Identidade do fornecedor → coluna `fornecedor` em `profiles`
2. Cargo → dropdown de `opcoes.cargos`
3. Importação → merge/upsert por `(nome, fornecedor)`
4. Unique constraint de `terceiros` → `(nome, fornecedor)` em vez de `(nome)`
5. Rota → `/fornecedor` separada do app principal
6. Template de importação → XLSX (ExcelJS já instalado)

---

## Etapas (cada uma é independente e mergeável isoladamente)

### Etapa 1 — Migração de banco (RLS + constraint)

**Criar:** `supabase/migrations/<timestamp>_fornecedor_scope.sql`

Conteúdo:
- `ALTER TABLE profiles ADD COLUMN fornecedor TEXT NULL` (NULL = usuário interno; preenchido = usuário fornecedor)
- `DROP CONSTRAINT terceiros_nome_key` + `ADD CONSTRAINT terceiros_nome_fornecedor_unique UNIQUE (nome, fornecedor)`
- Função `current_fornecedor()` retornando `SELECT fornecedor FROM profiles WHERE id = auth.uid()`
- Novas policies em `terceiros`:
  - `terceiros_select_fornecedor` — `current_fornecedor() IS NOT NULL AND fornecedor = current_fornecedor()`
  - `terceiros_insert_fornecedor` / `update` / `delete` — idem, garante AAL2 onde já aplicado
- Manter policies admin-only existentes (admin continua vendo tudo via `is_admin()` OR)

**Risco:** policies antigas em `fix_rls_admin_only.sql` precisam ser combinadas com OR — testar que admin continua editando após migração.

---

### Etapa 2 — Tipos e contexto do fornecedor logado

**Modificar:** `src/types/index.ts` (ou onde estiver `Profile`) — adicionar `fornecedor: string | null`

**Criar:** `src/hooks/useFornecedorAtual.ts` (~40 linhas)
- Lê `profiles.fornecedor` do usuário logado
- Expõe `{ fornecedor, isFornecedorUser, loading }`
- Cacheia em memory (uma chamada por sessão)

Reutiliza: `useAuthStatus()`, cliente Supabase em `src/lib/supabase.ts`

---

### Etapa 3 — Hook CRUD escopado

**Criar:** `src/hooks/useTerceirosDoFornecedor.ts` (~80 linhas)

API: `{ pessoas, loading, addPessoa(nome, cargo), updatePessoa(id, partial), deletePessoa(id), upsertMany(lista) }`

- Internamente injeta `fornecedor` (do hook da Etapa 2) em todas as operações
- Reutiliza padrão de `useHierarquia.ts` (linhas 90-111) sem estendê-lo — responsabilidade única
- `upsertMany` usa `supabase.from('terceiros').upsert(rows, { onConflict: 'nome,fornecedor' })`

**Não tocar:** `src/hooks/useHierarquia.ts` (continua servindo a tela admin de configurações).

---

### Etapa 4 — Atribuir fornecedor a usuário (AdminPage)

**Modificar:** `src/pages/AdminPage.tsx` e/ou seu form de criação/edição
- Adicionar campo "Fornecedor (opcional)" → select de `opcoes.fornecedores`
- Persiste em `profiles.fornecedor`
- Quando preenchido, marca usuário como "perfil fornecedor" (exibir badge visual na lista)

**Risco:** formulário pode passar de 200 linhas. Se já estiver perto, extrair o campo em `AdminUserFornecedorField.tsx`.

---

### Etapa 5 — Roteamento + redirecionamento

**Modificar:** `src/App.tsx`
- Adicionar `const FornecedorPage = lazy(() => import('./pages/FornecedorPage'))`
- Adicionar `const FornecedorMobilePage = lazy(() => import('./pages/FornecedorMobilePage'))`
- Novas rotas: `/fornecedor` e `/fornecedor/mobile`
- No handler pós-login (onde `deviceMode` é lido): se `profiles.fornecedor != null` → redirecionar para `/fornecedor` (ou `/fornecedor/mobile` se `deviceMode === 'mobile'`), **antes** da lógica atual
- Guard nas rotas `/`, `/mobile`, `/admin`: se usuário é fornecedor → redirect para `/fornecedor`

---

### Etapa 6 — Shell simplificado

**Criar:** `src/components/layout/FornecedorShell.tsx` (~60 linhas)
- Header: logo + nome do fornecedor + botão logout (sem ActivityBar, sem TabBar)
- `children` ocupa área principal
- Reusa `useAuthStatus().signOut`
- Responsabilidade única: layout estrutural, sem lógica de negócio

---

### Etapa 7 — Lib: template e parser de importação

**Criar:** `src/lib/fornecedor-pessoas-template.ts` (~50 linhas)
- `exportTemplate(): Promise<Blob>` — gera XLSX com colunas `Nome Completo` e `Cargo`, 1 linha de exemplo
- Usa ExcelJS (já no projeto)

**Criar:** `src/lib/fornecedor-pessoas-import.ts` (~120 linhas)
- `parseImportFile(file: File, cargosValidos: string[]): Promise<ImportResult>`
- Suporta `.csv` (semicolon) e `.xlsx`
- Retorna `{ valid: {nome, cargo}[], invalid: {linha, motivo}[], total }`
- Reusa padrão de `src/lib/import-registros-csv.ts` (linhas 76-200) para normalizar headers, sanitizar nomes (UPPER), detectar duplicatas intra-arquivo
- Validações: nome não vazio, nome >2 chars, cargo presente em `cargosValidos`, sem duplicata intra-arquivo

> Dividir em 2 arquivos pois export e import têm responsabilidades distintas.

---

### Etapa 8 — Página Desktop

**Criar:** `src/pages/FornecedorPage.tsx` (~80 linhas, só orquestração)
- Usa `FornecedorShell`
- Compõe os 3 componentes abaixo, sem lógica

**Criar:** `src/components/fornecedor/ContadorPessoas.tsx` (~40 linhas)
- Recebe `pessoas[]` por props
- Renderiza card: total + breakdown por cargo (`Object.entries(groupBy(pessoas, 'cargo'))`)

**Criar:** `src/components/fornecedor/ImportPessoasSection.tsx` (~150 linhas)
- Botão "Baixar modelo" (chama `exportTemplate`)
- Input file + preview tabela (válidos verde, inválidos vermelho com motivo)
- Botão "Confirmar importação" (chama `upsertMany` do hook Etapa 3)
- Toast de sucesso/erro

**Criar:** `src/components/fornecedor/CrudPessoasSection.tsx` (~180 linhas)
- Espelha estrutura de `ConfigPessoasSection` (linhas 31-75) mas:
  - Remove coluna fornecedor (já fixo)
  - Dropdown cargo lê de `opcoes.cargos`
  - Search input + paginação (>20 itens)
  - Confirm dialog real (não `window.confirm`) — usar `<AlertDialog>` shadcn já presente

> Se ultrapassar 200 linhas, extrair `PessoaTableRow.tsx` para a linha de edição inline.

---

### Etapa 9 — Página Mobile

**Criar:** `src/pages/FornecedorMobilePage.tsx` (~120 linhas)
- Top bar simplificado (igual a `MobileLancamentosPage` linhas 612-647 mas só com logout)
- Lista scrollável de `PessoaMobileCard`
- FAB para abrir `AddPessoaSheet`
- Botão secundário "Adicionar vários" → `AddPessoasBatchSheet`

**Criar:** `src/components/fornecedor/mobile/PessoaMobileCard.tsx` (~60 linhas)
- Card com nome + badge cargo
- Ações: editar (abre sheet edição) / deletar (confirm)

**Criar:** `src/components/fornecedor/mobile/AddPessoaSheet.tsx` (~80 linhas)
- Bottom sheet com input nome + select cargo + botão salvar
- Modo dual: criar e editar (recebe `pessoaInicial?` por props)

**Criar:** `src/components/fornecedor/mobile/AddPessoasBatchSheet.tsx` (~100 linhas)
- Lista de linhas `[nome] [cargo] [remover]`
- Botão "+ linha" e "Salvar todos"
- Chama `upsertMany` do hook Etapa 3
- Mostra erros por linha sem perder o que foi digitado

---

### Etapa 10 — i18n e testes mínimos

**Modificar:** `src/lib/i18n-translations.ts` — adicionar chaves `fornecedor_*` (header, vazio, ações)

**Criar:** `src/test/fornecedor-pessoas-import.test.ts` — cobertura mínima:
- CSV válido → 3 válidos
- CSV com duplicata → marca segundo como inválido
- Cargo fora da lista → inválido
- XLSX válido → parse correto

> Manter teste E2E de fluxo completo (login fornecedor → CRUD) fora do escopo desta entrega.

---

## Arquivos a CRIAR

| # | Arquivo |
|---|---------|
| 1 | `supabase/migrations/<ts>_fornecedor_scope.sql` |
| 2 | `src/hooks/useFornecedorAtual.ts` |
| 3 | `src/hooks/useTerceirosDoFornecedor.ts` |
| 4 | `src/components/layout/FornecedorShell.tsx` |
| 5 | `src/lib/fornecedor-pessoas-template.ts` |
| 6 | `src/lib/fornecedor-pessoas-import.ts` |
| 7 | `src/pages/FornecedorPage.tsx` |
| 8 | `src/pages/FornecedorMobilePage.tsx` |
| 9 | `src/components/fornecedor/ContadorPessoas.tsx` |
| 10 | `src/components/fornecedor/ImportPessoasSection.tsx` |
| 11 | `src/components/fornecedor/CrudPessoasSection.tsx` |
| 12 | `src/components/fornecedor/mobile/PessoaMobileCard.tsx` |
| 13 | `src/components/fornecedor/mobile/AddPessoaSheet.tsx` |
| 14 | `src/components/fornecedor/mobile/AddPessoasBatchSheet.tsx` |
| 15 | `src/test/fornecedor-pessoas-import.test.ts` |

## Arquivos a MODIFICAR

| Arquivo | Motivo |
|---------|--------|
| `src/App.tsx` | Rotas `/fornecedor`, `/fornecedor/mobile` + redirect pós-login |
| `src/types/index.ts` | Campo `fornecedor` em `Profile` |
| `src/pages/AdminPage.tsx` (ou subform) | Campo "Fornecedor" no cadastro de usuário |
| `src/lib/i18n-translations.ts` | Chaves de tradução `fornecedor_*` |

## Arquivos que NÃO devem ser tocados

- `src/hooks/useHierarquia.ts` — segue servindo a configuração admin
- `src/components/configuracoes/ConfigPessoasSection.tsx` — fica como ferramenta admin
- `src/components/forms/FormLancamento.tsx` — `AutocompleteNome` já filtra por fornecedor; nenhum ajuste necessário
- `src/lib/import-registros-csv.ts` — usar como referência, não modificar
- `src/components/layout/AppShell.tsx`, `ActivityBar.tsx`, `TabBar.tsx`, `StatusBar.tsx` — layout do app principal permanece intacto
- `src/hooks/useStorage.ts` — registros não mudam
- Demais migrations antigas — apenas a nova migration é adicionada

---

## Funções e utilitários a reutilizar

- `useAuthStatus()` em `src/hooks/useAuthStatus.ts` — sessão e signOut
- `supabase` cliente em `src/lib/supabase.ts`
- Padrão CRUD de `useHierarquia.ts` linhas 90-111 (como referência, não estender)
- Padrão de parser de `src/lib/import-registros-csv.ts` linhas 76-200 (normalização de headers, sanitização)
- `<AlertDialog>`, `<Sheet>`, `<Card>`, `<Table>`, `<Select>`, `<Input>` do `src/components/ui/`
- ExcelJS para template XLSX
- `logAudit()` (se existir) para registrar import em massa

---

## Verificação end-to-end

1. **Migração**: `npx supabase db push` → checar que `profiles.fornecedor` existe e que constraint `terceiros_nome_fornecedor_unique` foi criada.
2. **Admin atribui fornecedor**: logar como admin → AdminPage → criar usuário com fornecedor "LIDER MASTER" → verificar `profiles` no banco.
3. **Login fornecedor desktop**: logar com usuário fornecedor → confirmar redirecionamento para `/fornecedor` → tela mostra contador, importação e CRUD.
4. **Import**: baixar modelo, preencher 3 nomes válidos + 1 duplicado + 1 com cargo inválido → confirmar preview correto → confirmar importação → checar que só os 3 válidos entraram em `terceiros`.
5. **CRUD desktop**: adicionar, editar, deletar uma pessoa → verificar persistência.
6. **Isolamento**: logar como usuário de outro fornecedor → confirmar que não vê os dados do primeiro.
7. **Mobile**: forçar `deviceMode=mobile` → login fornecedor → confirmar redirect para `/fornecedor/mobile` → testar FAB simples + "Adicionar vários".
8. **Integração com lançamento**: logar como operador interno → criar lançamento → confirmar que dropdown de nomes só mostra os terceiros do fornecedor selecionado.
9. **Testes unitários**: `npm run test src/test/fornecedor-pessoas-import.test.ts`.

---

## Estimativa e riscos

**Arquivos impactados:** 15 a criar, 4 a modificar = **19 arquivos**

**Linhas estimadas:** ~1.300 (média ~85 por arquivo novo).

**Riscos / dependências críticas:**

1. **Migração de constraint** — `DROP CONSTRAINT terceiros_nome_key` falha se houver dados existentes com nomes duplicados entre fornecedores diferentes (cenário improvável hoje, mas validar). Mitigação: script de validação prévio.
2. **Composição de RLS antiga + nova** — policies em `fix_rls_admin_only.sql` precisam ser **substituídas** ou combinadas via `OR is_admin()`, senão admin perde acesso. Testar antes de aplicar em produção.
3. **Redirecionamento pós-login** — alterar `App.tsx` mexe com fluxo de auth/MFA já delicado. Testar todos os caminhos: admin, usuário comum, fornecedor, com/sem MFA, com `deviceMode` mobile/desktop.
4. **Cargo "fora da lista" durante import** — fornecedor pode importar cargo que não está em `opcoes.cargos`. Decisão atual: rejeita linha. Alternativa futura: pedir admin para aprovar novo cargo (fora do escopo).
5. **AdminPage > 200 linhas** — provável que já esteja perto do limite; extrair `AdminUserFornecedorField` se necessário.
6. **i18n** — chaves novas precisam ser adicionadas em pt-BR e en-US para evitar fallback quebrado.
