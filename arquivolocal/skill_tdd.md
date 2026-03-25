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

# 🏁 Conclusão

TDD não é sobre testes. É sobre **mudar código com segurança e rapidez**. Ele permite evoluir o design, confiar na IA e evitar dívida técnica — um passo de cada vez.

