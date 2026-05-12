1. Identidade do fornecedor (bloqueante)
O sistema atual não distingue usuários por fornecedor. Qualquer usuário autenticado vê tudo. A spec diz que o próprio fornecedor faz upload. Como o sistema sabe qual fornecedor está logado?

## Opções:

Opção	Prós	Contras
A) Campo fornecedor em profiles + RLS	Seguro, isolamento real	Requer migração + admin cadastrar usuários de fornecedor
B) Usuário seleciona seu fornecedor na página	Simples, sem migração	Sem isolamento — fornecedor A pode editar B
C) Link de acesso único por fornecedor (magic link)	Sem cadastro de usuário	Complexidade nova, sem auth persistente

R: Opção A — adicionar fornecedor_id (ou fornecedor TEXT) em profiles, RLS filtra terceiros por fornecedor do usuário logado.

2. Cargo: lista controlada ou texto livre?
## opcoes.cargos já existe como lista global. Fornecedor deve:

R: Escolher de uma lista fixa (dropdown do opcoes.cargos)

3. Importação CSV: merge ou replace?
Se o fornecedor importar arquivo com 50 nomes, e já havia 30 cadastrados:

R: Merge (upsert): mantém existentes, adiciona novos, atualiza cargo se mudou

4. Conflito de nome duplicado
terceiros tem nome UPPERCASE único globalmente hoje. Com fornecedores diferentes, "JOÃO SILVA" do fornecedor A ≠ "JOÃO SILVA" do fornecedor B. Uniqueness precisa ser (nome, fornecedor) não só nome.

## R: OK

## Isso impacta:

Constraint na tabela terceiros
Lógica de deduplicação em useHierarquia()
AutocompleteNome no FormLancamento (já filtra por fornecedor — OK)

5. Rota e navegação
Nova página ou nova aba no sistema existente?

R: Nova rota /fornecedor — acesso isolado, ideal se fornecedor tem login próprio
Recomendação: rota /fornecedor separada com layout simplificado (sem ActivityBar completo, só logo + logout).

Especificação Completa
Banco de dados

-- 1. Migração: adicionar fornecedor ao perfil
ALTER TABLE profiles ADD COLUMN fornecedor TEXT REFERENCES opcoes_fornecedores(nome);

-- 2. Corrigir unique constraint em terceiros
ALTER TABLE terceiros DROP CONSTRAINT terceiros_nome_key;
ALTER TABLE terceiros ADD CONSTRAINT terceiros_nome_fornecedor_unique UNIQUE (nome, fornecedor);

-- 3. RLS: fornecedor só vê/edita os próprios terceiros
CREATE POLICY "terceiros_fornecedor_select" ON terceiros
## FOR SELECT USING (
fornecedor = (SELECT fornecedor FROM profiles WHERE id = auth.uid())
OR is_admin()
);

CREATE POLICY "terceiros_fornecedor_modify" ON terceiros
## FOR ALL USING (
fornecedor = (SELECT fornecedor FROM profiles WHERE id = auth.uid())
);

Página Desktop /fornecedor
Layout: AppShell simplificado (header com logo + nome do fornecedor + logout, sem ActivityBar)

Seção 1 — Contador

Card: "X pessoas cadastradas"
Breakdown por cargo (ex: "3 Auxiliares, 2 Operadores")

Seção 2 — Importação CSV

Botão "Baixar modelo" → gera XLSX com colunas: Nome Completo, Cargo
Dropzone + botão "Importar arquivo" (aceita .csv e .xlsx)
Preview da importação: tabela com linhas válidas/inválidas antes de confirmar
Botão "Confirmar importação" → upsert por (nome, fornecedor)
Erros mostrados por linha (igual ao padrão do importRegistrosFromCsv)

Seção 3 — Cadastro manual (CRUD)

Tabela igual ao ConfigPessoasSection mas sem coluna fornecedor (já fixo)
Colunas: Nome, Cargo, Ações
Add: input nome + dropdown cargo (opcoes.cargos) + botão adicionar
Edit inline: lápis → campos editáveis → OK/Cancelar
Delete: ícone lixeira + confirmação dialog
Search/filter por nome ou cargo
Paginação se >20 itens
Página Mobile /fornecedor (ou /mobile-fornecedor)
Layout: igual ao MobileLancamentosPage — top bar + cards + FAB

## Lista de pessoas:

Card por pessoa: nome em destaque + badge de cargo
Swipe ou botão de ação: editar / deletar
## FAB — "Adicionar pessoa":

Bottom sheet com dois campos: Nome (input + autocomplete preventivo de duplicata) + Cargo (select)
Botão "Salvar"
## Ação rápida (diferencial mobile):

Botão secundário no FAB ou tab: "Adicionar vários"
Lista de inputs empilhados — cada linha: [nome input] [cargo select] [remover]
Botão "+ linha" para adicionar mais
Salvar todos de uma vez (batch insert)
Integração com FormLancamento
Já funciona — AutocompleteNome já filtra terceiros por fornecedor selecionado. Nenhuma mudança necessária no fluxo de lançamento, desde que a constraint (nome, fornecedor) seja aplicada.

Fluxo de acesso do fornecedor
Admin cadastra usuário do fornecedor (AdminPage já existente) + define campo fornecedor no perfil
Fornecedor recebe email de convite (Supabase Auth magic link ou senha)
Login → detecta profiles.fornecedor != null → redireciona para /fornecedor em vez de /
Fornecedor gerencia seus funcionários
Na hora do lançamento (feito pelo operador interno), dropdown de nomes já aparece filtrado pelo fornecedor selecionado

Resumo das decisões pendentes
#	Decisão	Padrão recomendado

1	Como identificar fornecedor logado - Campo fornecedor em profiles
2	Cargo: lista	Lista de opcoes.cargos
3	Import: merge -	Merge/upsert por (nome, fornecedor)
4	Unique constraint - (nome, fornecedor) em vez de só nome
5	Rota - /fornecedor separada do app principal
6	Template de importação - XLSX (ExcelJS já instalado)




