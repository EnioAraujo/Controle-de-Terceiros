# Regras de Negócio — Tela de Fechamento

> **Última atualização:** 2026-03-14
> **Status:** DEFINIDO — pronto para implementação

---

## 1. Objetivo

Calcular o valor financeiro de cada período de fechamento (10 dias ou range customizado),
baseado nas presenças registradas, no valor da diária por fornecedor+turno (+ajustes por pessoa),
com fluxo de aprovação, exportação (XLSX/PDF) e histórico salvo em banco.

---

## 2. Períodos de Fechamento

### 2.1 Períodos padrão

| Período | Início | Fim               |
|---------|--------|-------------------|
| 1º      | Dia 1  | Dia 10            |
| 2º      | Dia 11 | Dia 20            |
| 3º      | Dia 21 | Último dia do mês |

### 2.2 Período customizado por fornecedor

Alguns fornecedores podem ter períodos de fechamento diferentes.
O sistema permite configurar períodos alternativos por fornecedor.

### 2.3 Seleção por range de datas

Além dos períodos pré-definidos, o usuário pode selecionar um **range livre de datas**
(data início → data fim) para calcular o fechamento de um fornecedor específico.

---

## 3. Valor da Diária

### 3.1 Hierarquia de valores (prioridade)

O valor da diária segue uma hierarquia de 3 níveis, do mais específico ao mais genérico:

| Prioridade | Nível                          | Exemplo                                    |
|------------|--------------------------------|--------------------------------------------|
| 1ª (maior) | **Por pessoa (ajuste ad-hoc)** | João (JSS, 1ª TURNO) = R$ 280 neste dia    |
| 2ª         | **Por fornecedor + turno**     | JSS + 1ª TURNO = R$ 200                    |
| 3ª (menor) | **Valor padrão (fallback)**    | R$ 250                                     |

### 3.2 Regra de resolução

```
SE existe ajuste_por_pessoa para (pessoa, data):
    valor_diaria = ajuste_pessoa
SENÃO SE existe config (fornecedor, turno):
    valor_diaria = config_fornecedor_turno
SENÃO:
    valor_diaria = valor_padrao (R$ 250)
```

### 3.3 Exemplo real (baseado na fórmula Excel do usuário)

| Fornecedor | Turno      | Valor Diária |
|------------|------------|--------------|
| JSS        | 1ª TURNO   | R$ 200,00    |
| JSS        | 2ª TURNO   | R$ 200,00    |
| JSS        | 3ª TURNO   | R$ 230,00    |
| *(outros)* | *(qualquer)* | R$ 250,00  |

### 3.4 Ajuste por pessoa (ad-hoc)

O usuário pode, na tela de fechamento, alterar o valor de uma pessoa em um dia específico.
Casos de uso:
- Pagar a mais por necessidade de hora extra pontual
- Trabalhador veio em dia especial (feriado, convocação)
- Correção de valor negociado

---

## 4. Hora Padrão por Turno

### 4.1 Valores padrão

| Turno          | Horário             | Hora Padrão | Decimal    |
|----------------|---------------------|-------------|------------|
| 1ª TURNO       | 05:21 às 13:40      | 08:20       | 8.3333h    |
| 2ª TURNO       | 13:41 às 22:00      | 08:20       | 8.3333h    |
| 3ª TURNO       | 22:01 às 05:20      | 07:20       | 7.3333h    |
| INTERMEDIÁRIO  | 07:00 às 16:48      | 09:48       | 9.8000h    |

> **Nota:** O valor cheio da diária é pago quando o trabalhador cumpre a carga total do turno.
> Ex: INTERMEDIÁRIO com diária R$250 e carga 09:48 → `valor_hora = 250 / 9.8 ≈ R$25,51`
> Se trabalhou 09:48 (9.8h): `25.51 × 9.8 = R$250,00` (valor cheio).
> Se trabalhou 08:00 (8.0h): `25.51 × 8.0 = R$204,08` (proporcional).

### 4.2 Configurável

- O usuário pode **alterar** os horários e a hora padrão de cada turno nas Configurações
- Turnos criados pelo usuário devem ter hora padrão obrigatória ao ser configurado
- A hora padrão afeta diretamente o cálculo do valor da hora

---

## 5. Fórmula de Cálculo

### 5.1 Valor da hora

```
valor_hora = valor_diaria / hora_padrao_turno_decimal
```

### 5.2 Valor real do dia trabalhado

```
SE horas_trabalhadas >= hora_padrao_turno:
    valor_dia = valor_diaria                          (valor cheio do contrato)
SENÃO:
    valor_dia = valor_hora × horas_trabalhadas        (proporcional)
```

> **Regra fundamental:** Mesmo que o trabalhador fique 12h, recebe apenas o valor
> da diária contratual. Valor diferente só com acordo ad-hoc por pessoa/dia.

### 5.3 Total do período por fornecedor

```
total_periodo = Σ valor_dia  (para todos os registros do fornecedor no período)
```

### 5.4 Exemplo completo

**Fornecedor: JSS | Turno: 1ª TURNO | Período: 01-10/Mar/2026**

| Dado                  | Valor                           |
|-----------------------|---------------------------------|
| Valor diária          | R$ 200,00                       |
| Hora padrão (1ª)      | 08:20 = 8.3333h                 |
| Valor hora            | 200 / 8.3333 = **R$ 24,00**    |
| João (09:00 = 9.0h)   | 9.0 >= 8.33 → **R$ 200,00** (valor cheio) |
| Maria (08:20 = 8.33h) | 8.33 >= 8.33 → **R$ 200,00** (valor cheio) |
| Pedro (07:00 = 7.0h)  | 7.0 < 8.33 → 24.00 × 7.0 = **R$ 168,00** (proporcional) |

**Total período (3 pessoas × 10 dias):**
- Σ de todos os `valor_dia` de cada pessoa em cada dia
- Não é simplesmente `presenças × diária`, pois dependo das horas reais

### 5.5 Horas extras

- **Sem valor diferenciado.** Se trabalhou a carga completa ou mais, recebe o valor cheio (diária contratual).
- Se trabalhou **menos** que a carga padrão, recebe proporcional.
- **Ajuste ad-hoc por pessoa:** Para pagar valor diferente (bônus, convocação especial),
  o usuário altera manualmente o valor daquela pessoa naquele dia via tela de fechamento.

---

## 6. Agrupamento e Filtros

### 6.1 Agrupamento principal: por Fornecedor

O fechamento é sempre agrupado por **fornecedor**. Cada fornecedor tem:
- Total de presenças no período
- Total de horas trabalhadas
- Valor total calculado

### 6.2 Filtros disponíveis

| Filtro             | Tipo                 | Descrição                                       |
|--------------------|----------------------|-------------------------------------------------|
| Mês                | Seletor (YYYY-MM)    | Mês de referência                               |
| Período            | Pré-definido: 1º/2º/3º | Seleciona dias 1-10, 11-20 ou 21-fim          |
| Range de datas     | Data início → Data fim | Seleção livre, sobrepõe o período pré-definido |
| Fornecedor         | Seletor individual   | Seleciona qual fornecedor fechar                |

### 6.3 Fluxo de seleção

1. Usuário seleciona o **mês** ou define **range de datas**
2. Seleciona o **fornecedor** específico
3. Sistema calcula e exibe o fechamento
4. Usuário pode ajustar valores individuais (por pessoa/dia)
5. Usuário salva/aprova o fechamento

---

## 7. Fluxo de Aprovação

### 7.1 Status do fechamento

| Status        | Descrição                                          |
|---------------|-----------------------------------------------------|
| `rascunho`    | Fechamento calculado, editável                      |
| `enviado`     | Enviado ao fornecedor para conferência              |
| `revisao`     | Fornecedor reportou divergências, aguardando ajuste |
| `aprovado`    | Valores finais confirmados                          |

### 7.2 Fluxo

```
[Calcular] → rascunho → [Enviar] → enviado → [Fornecedor responde]
                                                    ↓
                                              revisao (ajustar valores)
                                                    ↓
                                              [Reagir] → enviado ou aprovado
```

### 7.3 Ações do usuário na tela

- **Editar valor por pessoa/dia:** Alterar o valor calculado de uma linha específica
- **Adicionar presença:** Inserir registro de presença que não existia (fornecedor reportou falta)
- **Remover presença:** Marcar que um registro não deve contar (erro de marcação)
- **Alterar status:** Avançar o status do fechamento (rascunho → enviado → aprovado)

---

## 8. Exportação

### 8.1 Formatos

| Formato | Conteúdo                                                              |
|---------|-----------------------------------------------------------------------|
| XLSX    | Dados tabulares completos (por pessoa/dia, subtotais, total geral)    |
| PDF     | Relatório formatado com totais por pessoa, dias de presença, turnos   |

### 8.2 Conteúdo do relatório

- **Cabeçalho:** Fornecedor, período, total geral
- **Corpo:** Tabela por pessoa com:
  - Nome
  - Dias de presença (datas)
  - Turno de cada dia
  - Horas trabalhadas por dia
  - Valor diária usado
  - Valor calculado por dia
  - Subtotal por pessoa
- **Rodapé:** Total geral do período

---

## 9. Armazenamento (Banco de Dados)

### 9.1 Tabela `fechamentos` (novo)

Armazena o cabeçalho de cada fechamento.

| Coluna          | Tipo       | Descrição                              |
|-----------------|------------|----------------------------------------|
| id              | UUID PK    | Identificador único                    |
| fornecedor      | TEXT       | Nome do fornecedor                     |
| data_inicio     | DATE       | Início do período                      |
| data_fim        | DATE       | Fim do período                         |
| status          | TEXT       | rascunho / enviado / revisao / aprovado|
| valor_total     | NUMERIC    | Soma total calculada                   |
| created_at      | TIMESTAMPTZ| Data de criação                        |
| updated_at      | TIMESTAMPTZ| Última atualização                     |
| created_by      | UUID       | Usuário que criou                      |

### 9.2 Tabela `fechamento_itens` (novo)

Armazena o detalhe de cada linha do fechamento (por pessoa/dia).

| Coluna          | Tipo       | Descrição                              |
|-----------------|------------|----------------------------------------|
| id              | UUID PK    | Identificador único                    |
| fechamento_id   | UUID FK    | Referência ao fechamento               |
| registro_id     | TEXT FK    | Referência ao registro de presença     |
| nome            | TEXT       | Nome do trabalhador                    |
| data            | DATE       | Data do registro                       |
| turno           | TEXT       | Turno trabalhado                       |
| horas           | TEXT       | Horas trabalhadas (HH:MM)             |
| valor_diaria    | NUMERIC    | Valor da diária usado neste cálculo    |
| valor_hora      | NUMERIC    | Valor da hora calculado                |
| valor_calculado | NUMERIC    | Valor final desta linha                |
| ajuste_manual   | BOOLEAN    | Se houve edição manual do valor        |
| obs             | TEXT       | Observação do ajuste (se houver)       |

### 9.3 Tabela `diarias_config` (novo)

Armazena a configuração de valores de diárias por fornecedor+turno.

| Coluna          | Tipo       | Descrição                              |
|-----------------|------------|----------------------------------------|
| id              | UUID PK    | Identificador único                    |
| fornecedor      | TEXT       | Nome do fornecedor                     |
| turno           | TEXT       | Nome do turno (NULL = todos)           |
| valor_diaria    | NUMERIC    | Valor da diária em reais               |
| created_at      | TIMESTAMPTZ| Data de criação                        |

**Constraint:** UNIQUE(fornecedor, turno)

### 9.4 Tabela `turnos_config` (novo ou extensão de opcoes)

Armazena a hora padrão de cada turno.

| Coluna          | Tipo       | Descrição                              |
|-----------------|------------|----------------------------------------|
| turno           | TEXT PK    | Nome do turno                          |
| hora_inicio     | TEXT       | Horário de início (HH:MM)             |
| hora_fim        | TEXT       | Horário de fim (HH:MM)                |
| hora_padrao     | TEXT       | Duração padrão (HH:MM)                |

---

## 10. Dashboard — Indicadores de Fechamento

No dashboard principal, exibir:

| Indicador                    | Descrição                                          |
|------------------------------|----------------------------------------------------|
| Valor pago no mês (total)    | Soma dos fechamentos aprovados no mês corrente     |
| Valor por fornecedor (mês)   | Breakdown por fornecedor dos fechamentos aprovados  |
| Média mensal                 | Média dos valores pagos nos últimos N meses        |
| Fechamentos pendentes        | Quantidade de fechamentos em rascunho ou revisão   |

---

## 11. Interface — Tela de Fechamento

### 11.1 Nova aba: "Fechamento"

5ª aba na navbar, entre "Fornecedores" e "Configurações".

### 11.2 Layout da tela

**Barra superior:**
- Seletor de mês (YYYY-MM)
- Seletor de período (1º / 2º / 3º / Custom)
- Ou: campos de data início e data fim (range livre)
- Seletor de fornecedor

**Área principal:**
1. **Resumo do fornecedor:** card com total de presenças, total de horas, valor total
2. **Tabela detalhada:** por pessoa/dia com colunas:
   - Nome | Data | Turno | Horas | Valor Diária | Valor Hora | Valor Dia | Ações
3. **Linha editável:** ao clicar, permite alterar `valor_diaria` daquela linha
4. **Botão "Adicionar presença":** para inserir registro manual
5. **Subtotais por pessoa:** ao final de cada bloco de pessoa

**Barra inferior:**
- Status atual do fechamento
- Botões: Salvar | Exportar XLSX | Exportar PDF | Alterar Status

### 11.3 Tela de Configuração de Diárias

Na aba **Configurações**, nova seção para gerenciar:
- Valores de diária por fornecedor + turno (tabela editável)
- Hora padrão por turno (tabela editável)
- Valor padrão (fallback)

---

## 12. Referência Rápida — Regras Decididas

| # | Pergunta                              | Resposta                                                    |
|---|---------------------------------------|-------------------------------------------------------------|
| 1 | Períodos fixos ou customizáveis?      | Fixos (1-10, 11-20, 21-fim) + range livre + custom/fornecedor |
| 2 | Valor da diária por quê?              | Por fornecedor+turno, com ajuste ad-hoc por pessoa/dia      |
| 3 | Hora padrão do INTERMEDIÁRIO?         | 09:48 (07:00-16:48). Valor cheio pago na carga total. Configurável. |
| 4 | Horas extras valor diferenciado?      | Não. Valor cheio se cumpriu carga; proporcional se fez menos. Ajuste manual se necessário.|
| 5 | Agrupamento por CC?                   | Não. Agrupamento por fornecedor.                            |
| 6 | Exportação?                           | XLSX + PDF formatado (totais por pessoa, dias, turnos)      |
| 7 | Valores configuráveis?                | Sim, tela de Configurações                                  |
| 8 | Fluxo de aprovação?                   | Sim (rascunho → enviado → revisão → aprovado)               |
| 9 | Salvar no banco?                      | Sim, com histórico. Dashboard mostra valores pagos/média.   |
