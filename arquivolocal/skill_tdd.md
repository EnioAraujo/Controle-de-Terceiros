# ✅ SKILL: Como Aplicar TDD (Test-Driven Development)

## 🎯 Objetivo da Skill

Ensinar como aplicar TDD de forma simples, repetível e eficaz, garantindo código seguro, refatoração fácil e evolução contínua — inclusive com IA como copiloto.

\---

# 🧩 1. Ciclo Fundamental do TDD (Red → Green → Refactor)

## 1️⃣ RED – Escreva um teste que falha

* Defina o comportamento desejado antes do código.
* Escreva o teste mais simples possível.
* Rode o teste e confirme que **falha**.

```ruby
def test\_soma\_basica
  assert\_equal 4, soma(2, 2)
end
```

\---

## 2️⃣ GREEN – Escreva o código mínimo para passar o teste

```ruby
def soma(a, b)
  a + b
end
```

\---

## 3️⃣ REFACTOR – Melhore o código mantendo os testes verdes

* Limpe nomes, extraia métodos, remova duplicações.
* Garanta que todos os testes continuam passando.

\---

# 🧠 2. Princípios Estratégicos

## ✅ Comece sempre pelo comportamento externo

Pergunte: **“O que precisa acontecer?”** → transforme em teste.

## ✅ Testes pequenos e focados

Um teste deve validar **um único comportamento**.

## ✅ Use IA como parceira

* Gerar testes
* Sugerir edge cases
* Criar mocks/stubs
* Ajudar no refactoring

## ✅ Confie nos testes para evoluir o design

O design emergirá naturalmente conforme os testes pedem.

\---

# 🧪 3. Tipos essenciais de testes no TDD

### ✅ Testes de unidade

Focados em funções e regras isoladas.

### ✅ Testes de integração

Garantem que múltiplas partes trabalham juntas.

### ✅ Testes contra regressão

Encontrou um bug? Escreva um teste que o reproduza **antes** da correção.

\---

# 🔁 4. Fluxo prático recomendado

1. Defina o micro‑objetivo
2. Escreva o teste → falha
3. Escreva o código mínimo
4. Execute os testes → tudo verde
5. Refatore com segurança
6. Verifique se o teste comunica o comportamento correto

\---

# 🚀 5. Checklist da Skill

* \[ ] Escrevi o teste antes?
* \[ ] O teste falhou primeiro?
* \[ ] Fiz o mínimo para passar?
* \[ ] Refatorei com testes verdes?
* \[ ] Evitei código sem propósito?
* \[ ] Os testes explicam o comportamento?
* \[ ] IA foi usada como apoio, não como autoridade?
* \[ ] Commit está **production-ready**?

\---

# 🧹 6. Identificação de Verbosidade e Over-Engineering

Antes de refatorar, é preciso saber **o que merece refatoração**. Esta seção complementa o ciclo TDD com um protocolo de varredura de dívida técnica.

## 🔍 5 Padrões de Alerta

1. **Lógica duplicada** — o mesmo bloco de código (diff, validação, formatação) aparece em dois ou mais lugares com mínimas variações.
2. **Dependências mortas** — biblioteca instalada e configurada, mas sem nenhum ponto de uso real no projeto (ex: `QueryClientProvider` sem `useQuery`).
3. **Wrappers desnecessários** — componente que apenas re-renderiza um filho sem acrescentar lógica (ex: `<G cols={1}>`).
4. **Estilos inline repetidos** — o mesmo objeto de estilo com 4+ atributos copiado em 10+ lugares; candidato a constante ou classe utilitária.
5. **Arquivo monolítico** — arquivo único com +1500 linhas misturando hooks, UI, componentes e lógica de negócio; impossível testar unidades isoladas.

## ✅ Checklist Diagnóstico

Faça estas perguntas antes de qualquer refatoração:

* \[ ] Essa dependência é **realmente usada** em algum ponto do código?
* \[ ] Esse bloco de código **existe em mais de um lugar** com mínimas variações?
* \[ ] Esse wrapper/componente **acrescenta algo** além de passar props adiante?
* \[ ] Esse estilo inline tem **4+ atributos** e está repetido **5+ vezes**?
* \[ ] Esse arquivo tem **+1000 linhas** misturando responsabilidades distintas?
* \[ ] Ao escrever o teste desta função, precisei importar **coisas demais** do mesmo arquivo?

## 🔁 Fluxo Recomendado

1. **Identificar** o problema usando o checklist acima
2. **Registrar** em `arquivolocal/CONTEXT.md` → Seção 13 (Dívida Técnica) antes de qualquer alteração
3. **Escrever o teste** que valida o comportamento atual (fase Red do TDD)
4. **Refatorar** mantendo o teste verde (fase Refactor do TDD)
5. **Confirmar** que `pnpm test` continua passando
6. **Commitar** como `refactor(escopo): descrição` + atualizar histórico em `arquivolocal/CONTEXT.md`

\---

# 🏁 Conclusão

TDD não é sobre testes. É sobre **mudar código com segurança e rapidez**. Ele permite evoluir o design, confiar na IA e evitar dívida técnica — um passo de cada vez.

