# Regras de Fechamento — Conforme Implementadas

> **Resumo executivo** das regras de negócio do módulo de Fechamento, baseado no código atual em produção.
> Para o documento original com todo o detalhamento de design, consulte [`REGRAS_FECHAMENTO.md`](./REGRAS_FECHAMENTO.md).

---

## 1. Períodos

- **Padrão:** 1º (dias 1-10), 2º (11-20), 3º (21-fim do mês).
- **Range livre:** seleção de data início → data fim.
- **Custom por fornecedor:** períodos alternativos configuráveis por fornecedor.

---

## 2. Valor da Diária — Hierarquia de Resolução

A função `resolverDiaria()` em [`src/lib/fechamento-utils.ts`](../src/lib/fechamento-utils.ts) (linha 118) percorre os níveis abaixo, do mais específico ao mais genérico, e retorna o primeiro que casar:

| Prioridade | Nível | Descrição |
|---|---|---|
| 1ª | **Ajuste ad-hoc** | Override manual de valor por pessoa/dia, feito na tela de fechamento |
| 2ª | **Exato + vigência** | Config exato `(fornecedor, turno)` dentro da janela `vigencia_inicio..vigencia_fim` |
| 3ª | **Exato sem vigência** | Config exato `(fornecedor, turno)` sem vigência (sempre válido) |
| 4ª | **Fallback + vigência** | Config `(fornecedor, turno = NULL)` dentro da vigência |
| 5ª | **Fallback sem vigência** | Config `(fornecedor, turno = NULL)` sem vigência |
| 6ª | **Valor padrão** | `VALOR_PADRAO = R$ 250,00` (constante no código) |

---

## 3. Hora Padrão por Turno

Valores default usados no cálculo proporcional. Configuráveis via tabela `turnos_config` (e na UI de Configurações).

| Turno | Horário | Hora Padrão | Decimal |
|---|---|---|---|
| 1ª TURNO | 05:21 às 13:40 | 08:20 | 8,3333h |
| 2ª TURNO | 13:41 às 22:00 | 08:20 | 8,3333h |
| 3ª TURNO | 22:01 às 05:20 | 07:20 | 7,3333h |
| INTERMEDIÁRIO | 07:00 às 16:48 | 09:48 | 9,8000h |

- **Fallback de hora padrão** (se o turno não estiver na configuração): `08:20`.
- Função: `resolverHoraPadrao()` em [`src/lib/fechamento-utils.ts`](../src/lib/fechamento-utils.ts) (linha 151).

---

## 4. Fórmula de Cálculo do Valor do Dia

Implementada em `calcularValorDia()` em [`src/lib/fechamento-utils.ts`](../src/lib/fechamento-utils.ts) (linha 174).

```
valor_hora = valor_diaria / hora_padrao_decimal

SE horas_trabalhadas >= hora_padrao:
    valor_dia = valor_diaria                          (valor cheio do contrato)
SENÃO:
    valor_dia = valor_hora × horas_trabalhadas        (proporcional, arredondado a 2 casas)
```

### Regra-chave: sem hora extra

- Trabalhou **>=** carga padrão → recebe valor cheio da diária (mesmo que tenha trabalhado 12h).
- Trabalhou **<** carga padrão → recebe valor proporcional ao tempo efetivamente trabalhado.
- Para pagar valor diferente (bônus, convocação especial, feriado): **ajuste ad-hoc manual** na tela do fechamento.

### Exemplo

**Fornecedor: JSS | Turno: 1ª TURNO (8,3333h) | Diária: R$ 200,00**

- João trabalhou 09:00 (9,0h) → 9,0 >= 8,33 → **R$ 200,00** (valor cheio).
- Maria trabalhou 08:20 (8,33h) → 8,33 >= 8,33 → **R$ 200,00** (valor cheio).
- Pedro trabalhou 07:00 (7,0h) → 7,0 < 8,33 → `(200 / 8,3333) × 7,0` = **R$ 168,00** (proporcional).

---

## 5. Agrupamento

- **Agrupamento principal:** por **fornecedor** (não por centro de custo).
- Cada fornecedor exibe: total de presenças no período, total de horas trabalhadas, valor total calculado.
- Função `agruparPorPessoa()` em [`src/lib/fechamento-utils.ts`](../src/lib/fechamento-utils.ts) (linha 262) fornece o breakdown por pessoa dentro do fornecedor.

---

## 6. Filtros Disponíveis

| Filtro | Tipo | Descrição |
|---|---|---|
| Mês | Seletor (YYYY-MM) | Mês de referência |
| Período | Pré-definido: 1º / 2º / 3º | Seleciona dias 1-10, 11-20 ou 21-fim |
| Range de datas | Data início → Data fim | Seleção livre; sobrepõe o período pré-definido |
| Fornecedor | Seletor individual | Qual fornecedor fechar |

---

## 7. Fluxo de Aprovação (Status)

```
rascunho → enviado → revisao → aprovado
```

| Status | Descrição |
|---|---|
| `rascunho` | Fechamento calculado, ainda editável |
| `enviado` | Enviado ao fornecedor para conferência |
| `revisao` | Fornecedor reportou divergências, aguardando ajuste |
| `aprovado` | Valores finais confirmados |

Transições válidas mapeadas em `NEXT_STATUS` em [`src/lib/fechamento-utils.ts`](../src/lib/fechamento-utils.ts) (linha 384).

---

## 8. Ações do Usuário na Tela de Fechamento

- **Editar valor por pessoa/dia:** alterar o `valor_diaria` calculado de uma linha específica (marca `ajuste_manual = true` e exige justificativa em `obs`).
- **Adicionar presença manual:** inserir registro que não existia (fornecedor reportou falta de marcação).
- **Remover presença:** marcar que um registro não deve contar (erro de marcação).
- **Alterar status:** avançar o status do fechamento (rascunho → enviado → revisao → aprovado).

---

## 9. Persistência (Banco de Dados)

### Tabela `fechamentos`
Cabeçalho de cada fechamento.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | Identificador único |
| fornecedor | TEXT | Nome do fornecedor |
| data_inicio | DATE | Início do período |
| data_fim | DATE | Fim do período |
| status | TEXT | rascunho / enviado / revisao / aprovado |
| valor_total | NUMERIC | Soma total calculada |
| created_at | TIMESTAMPTZ | Data de criação |
| updated_at | TIMESTAMPTZ | Última atualização |
| created_by | UUID | Usuário que criou |

### Tabela `fechamento_itens`
Detalhe de cada linha do fechamento (por pessoa/dia).

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | Identificador único |
| fechamento_id | UUID FK | Referência ao fechamento |
| registro_id | TEXT FK | Referência ao registro de presença |
| nome | TEXT | Nome do trabalhador |
| data | DATE | Data do registro |
| turno | TEXT | Turno trabalhado |
| horas | TEXT | Horas trabalhadas (HH:MM) |
| valor_diaria | NUMERIC | Valor da diária usado neste cálculo |
| valor_hora | NUMERIC | Valor da hora calculado |
| valor_calculado | NUMERIC | Valor final desta linha |
| ajuste_manual | BOOLEAN | Se houve edição manual do valor |
| obs | TEXT | Observação do ajuste (se houver) |

### Tabela `diarias_config`
Configuração de valores de diárias por fornecedor + turno (com suporte a vigência temporal).

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | Identificador único |
| fornecedor | TEXT | Nome do fornecedor |
| turno | TEXT | Nome do turno (NULL = fallback para todos os turnos do fornecedor) |
| valor_diaria | NUMERIC | Valor da diária em reais |
| vigencia_inicio | DATE | Início da vigência (NULL = sempre válido) |
| vigencia_fim | DATE | Fim da vigência (NULL = sem fim) |
| created_at | TIMESTAMPTZ | Data de criação |

### Tabela `turnos_config`
Hora padrão e horários de cada turno.

| Coluna | Tipo | Descrição |
|---|---|---|
| turno | TEXT PK | Nome do turno |
| hora_inicio | TEXT | Horário de início (HH:MM) |
| hora_fim | TEXT | Horário de fim (HH:MM) |
| hora_padrao | TEXT | Duração padrão (HH:MM) |

---

## 10. Exportação

| Formato | Conteúdo |
|---|---|
| **XLSX** | Dados tabulares completos: por pessoa/dia, subtotais e total geral |
| **PDF** | Relatório formatado: cabeçalho (fornecedor + período + total), corpo por pessoa (nome, dias de presença, turno, horas, valor diária, valor calculado, subtotal), rodapé (total geral) |

---

## 11. Multi-Fornecedor

Utilitário em [`src/lib/fechamento-multifornecedor-utils.ts`](../src/lib/fechamento-multifornecedor-utils.ts) para gerar fechamentos de múltiplos fornecedores no mesmo período em uma única operação (batch).

---

## 12. Indicadores no Dashboard

No dashboard principal, são exibidos:

| Indicador | Descrição |
|---|---|
| Valor pago no mês | Soma dos fechamentos aprovados no mês corrente |
| Valor por fornecedor | Breakdown por fornecedor dos fechamentos aprovados |
| Média mensal | Média dos valores pagos nos últimos N meses |
| Fechamentos pendentes | Quantidade de fechamentos em rascunho ou revisão |

---

## 13. Referência Rápida — Decisões de Negócio

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Períodos fixos ou customizáveis? | Fixos (1-10, 11-20, 21-fim) + range livre + custom por fornecedor |
| 2 | Valor da diária definido por quê? | Por `fornecedor + turno`, com ajuste ad-hoc por pessoa/dia |
| 3 | Hora padrão do INTERMEDIÁRIO? | 09:48 (07:00-16:48). Configurável. |
| 4 | Hora extra com valor diferenciado? | Não. Valor cheio se cumpriu carga; proporcional se fez menos. Ajuste manual se necessário. |
| 5 | Agrupamento por centro de custo? | Não. Agrupamento por fornecedor. |
| 6 | Exportação? | XLSX + PDF formatado |
| 7 | Valores são configuráveis? | Sim, tela de Configurações |
| 8 | Fluxo de aprovação? | Sim: rascunho → enviado → revisao → aprovado |
| 9 | Salvar no banco com histórico? | Sim. Dashboard mostra valores pagos e médias mensais. |

---

## 14. Arquivos-Chave da Implementação

- [`src/lib/fechamento-utils.ts`](../src/lib/fechamento-utils.ts) — núcleo de cálculo, resolução de diárias, fórmulas, status.
- [`src/lib/fechamento-multifornecedor-utils.ts`](../src/lib/fechamento-multifornecedor-utils.ts) — utilitários multi-fornecedor.
- [`src/components/FechamentoTab.tsx`](../src/components/FechamentoTab.tsx) — tela principal de fechamento.
- [`src/components/fechamento/FechamentoItensTable.tsx`](../src/components/fechamento/FechamentoItensTable.tsx) — tabela detalhada de itens.
- [`supabase/migrations/fechamento_tables.sql`](../supabase/migrations/fechamento_tables.sql) — schema das tabelas.
- [`supabase/migrations/fechamento_api_rpc.sql`](../supabase/migrations/fechamento_api_rpc.sql) — funções RPC.
- [`supabase/migrations/diarias_config_add_vigencia.sql`](../supabase/migrations/diarias_config_add_vigencia.sql) — suporte a vigência temporal nos valores de diária.
