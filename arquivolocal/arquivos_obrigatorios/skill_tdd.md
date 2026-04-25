---
name: webapp-testing-tdd
description: Toolkit integrado para testes de aplicações web usando TDD, Playwright e automação. Suporta verificação de funcionalidade frontend, debugging de comportamento UI, captura de screenshots e testes contra regressão.
license: Complete terms in LICENSE.txt
---

# Testes de Aplicações Web com TDD + Playwright

Combine **Test-Driven Development (TDD)** com **Playwright** para evoluir código web com segurança, confiança e rapidez.

---

## 🎯 Objetivo da Skill

Ensinar como aplicar TDD na prática usando Playwright, garantindo:
- ✅ Código seguro e testável desde o início
- ✅ Refatoração sem medo de quebrar funcionalidades
- ✅ Design emergente a partir dos testes
- ✅ Uso de IA como copiloto (gerar testes, edge cases, mocks)

---

# 🧩 1. Ciclo Fundamental do TDD (Red → Green → Refactor)

## 1️⃣ RED – Escreva um teste que falha

Defina o comportamento desejado **antes** do código.

```python
def test_soma_basica():
    assert soma(2, 2) == 4

def test_formulario_valida_email_invalido():
    page.goto('http://localhost:5173/form')
    page.fill('input[name="email"]', 'email-invalido')
    page.click('button[type="submit"]')
    assert page.locator('.error-message').is_visible()
```

**Rode o teste e confirme que falha** ✓

---

## 2️⃣ GREEN – Escreva o código mínimo para passar o teste

Implementação simples e direta:

```javascript
// Frontend
function soma(a, b) {
  return a + b;
}

// Validação de formulário
function validateEmail(email) {
  return email.includes('@');
}
```

**Rode os testes e confirme que passam** ✓

---

## 3️⃣ REFACTOR – Melhore o código mantendo os testes verdes

Limpe nomes, extraia métodos, remova duplicações:

```javascript
// Antes (simples, mas sem tratamento)
function validateEmail(email) {
  return email.includes('@');
}

// Depois (refatorado, mais robusto)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return EMAIL_REGEX.test(email.trim());
}
```

**Garanta que todos os testes continuam passando** ✓

---

# 🧪 2. Tipos Essenciais de Testes no TDD

### ✅ Testes de Unidade

Focados em funções e regras isoladas:

```python
def test_soma_numeros_positivos():
    assert soma(5, 3) == 8

def test_soma_numeros_negativos():
    assert soma(-5, -3) == -8

def test_soma_zero():
    assert soma(0, 0) == 0
```

**Benefício**: Testes rápidos, fáceis de debugar.

---

### ✅ Testes de Integração (E2E com Playwright)

Garantem que múltiplas partes trabalham juntas:

```python
def test_fluxo_completo_login():
    """Usuário faz login, acessa dashboard e faz logout"""
    page.goto('http://localhost:5173/login')
    
    # Preenche formulário
    page.fill('input[name="email"]', 'user@example.com')
    page.fill('input[name="password"]', 'senha123')
    page.click('button[type="submit"]')
    
    # Aguarda redirecionamento
    page.wait_for_url('**/dashboard')
    assert page.locator('h1:has-text("Dashboard")').is_visible()
    
    # Faz logout
    page.click('button[aria-label="Logout"]')
    page.wait_for_url('**/login')
```

**Benefício**: Valida comportamento real do usuário.

---

### ✅ Testes contra Regressão

Encontrou um bug? Escreva um teste que o reproduza **antes** da correção:

```python
def test_bug_dropdown_nao_abre_segunda_vez():
    """
    REGRESSÃO: Dropdown não abre na segunda clicagem.
    Issue #142: https://github.com/...
    """
    page.goto('http://localhost:5173/dashboard')
    
    # Primeira abertura
    dropdown = page.locator('[data-testid="menu-dropdown"]')
    dropdown.click()
    assert page.locator('[data-testid="menu-options"]').is_visible()
    
    # Fecha
    page.click('body')
    assert not page.locator('[data-testid="menu-options"]').is_visible()
    
    # Segunda abertura (bug estava aqui)
    dropdown.click()
    assert page.locator('[data-testid="menu-options"]').is_visible()
```

**Benefício**: Garante que o bug não ressurge.

---

# 🔄 3. Decision Tree: Escolhendo Sua Abordagem

```
Tarefa → É HTML estático?
    ├─ Sim → Leia arquivo HTML diretamente
    │         ├─ Sucesso → Escreva teste com Playwright
    │         └─ Falha → Trate como dinâmica (abaixo)
    │
    └─ Não (webapp dinâmica) → Servidor já está rodando?
        ├─ Não → Use: python scripts/with_server.py --help
        │        Depois escreva teste Playwright simplificado
        │
        └─ Sim → Padrão Reconhecimento-Depois-Ação:
            1. Navegue e aguarde networkidle
            2. Capture screenshot ou inspecione DOM
            3. Identifique seletores do estado renderizado
            4. Execute ações com seletores descobertos
            5. Escreva teste TDD para validar comportamento
```

---

# 🚀 4. Workflow Prático Recomendado

### Cenário 1: Desenvolvendo uma nova feature com TDD

```bash
# 1. Defina o micro-objetivo
# "Usuário deve poder adicionar item à lista com Enter"

# 2. Escreva o teste (RED)
python -m pytest tests/test_todo_add.py::test_add_item_com_enter -v

# Resultado: FAIL ❌

# 3. Implemente o mínimo (GREEN)
# ... edite src/components/TodoList.jsx ...

# 4. Rode o teste novamente
python -m pytest tests/test_todo_add.py::test_add_item_com_enter -v

# Resultado: PASS ✅

# 5. Refatore com confiança (REFACTOR)
# ... limpe o código, extraia métodos ...

# 6. Confirme que tudo continua verde
python -m pytest tests/ -v

# 7. Commite
git commit -m "feat: adicionar item à lista com Enter"
```

---

### Cenário 2: Debugando um componente com Playwright

```python
# scripts/debug_form.py
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # headless=False para ver a ação
    page = browser.new_page()
    page.goto('http://localhost:5173/form')
    
    # RECONHECIMENTO: Inspecione o DOM
    page.wait_for_load_state('networkidle')
    page.screenshot(path='/tmp/form_inicial.png', full_page=True)
    
    # Identifique seletores
    inputs = page.locator('input').all()
    print(f"Encontrados {len(inputs)} inputs")
    
    # Interaja e observe
    page.fill('input[name="email"]', 'test@example.com')
    page.screenshot(path='/tmp/form_preenchido.png')
    
    # Verifique logs do console
    page.on('console', lambda msg: print(f"[{msg.type}] {msg.text}"))
    
    browser.close()
```

Execute com:
```bash
python scripts/debug_form.py
```

---

# 🛠️ 5. Usando Helper Scripts

**Always run scripts with `--help` first!**

### Servidor único:

```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python tests/test_app.py
```

### Múltiplos servidores (backend + frontend):

```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python tests/test_integration.py
```

Script de teste simplificado (servidores gerenciados automaticamente):

```python
# tests/test_app.py
from playwright.sync_api import sync_playwright

def test_homepage_carrega():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:5173')
        page.wait_for_load_state('networkidle')  # CRÍTICO
        
        assert page.locator('h1').is_visible()
        browser.close()
```

---

# 🔍 6. Padrão de Reconhecimento-Depois-Ação

Use quando precisar debugar ou explorar um componente novo:

### Passo 1: Inspecione o DOM renderizado

```python
page.screenshot(path='/tmp/inspect.png', full_page=True)
content = page.content()
buttons = page.locator('button').all()
print([btn.text_content() for btn in buttons])
```

### Passo 2: Identifique seletores

```python
# Estratégias em ordem de preferência
page.locator('button:has-text("Enviar")')       # Texto
page.locator('[data-testid="submit-btn"]')      # Test ID (melhor!)
page.locator('form button[type="submit"]')      # CSS
page.locator('role=button[name="Enviar"]')      # Accessibility
```

### Passo 3: Execute ações e capture efeitos

```python
page.click('[data-testid="menu-toggle"]')
page.wait_for_selector('[data-testid="menu-open"]')
page.screenshot(path='/tmp/menu_aberto.png')
```

### Passo 4: Transforme em teste TDD

```python
def test_menu_abre_ao_clicar():
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')
    
    # Menu inicialmente fechado
    assert not page.locator('[data-testid="menu-open"]').is_visible()
    
    # Clica no toggle
    page.click('[data-testid="menu-toggle"]')
    
    # Menu fica visível
    assert page.locator('[data-testid="menu-open"]').is_visible()
```

---

# ⚡ 7. Princípios Estratégicos

## ✅ Comece sempre pelo comportamento externo

Pergunte: **"O que precisa acontecer?"** → transforme em teste:

```python
# ❌ Errado: Pensar em "como" antes de "o quê"
# def implementar_cache()...

# ✅ Certo: Definir o comportamento esperado
def test_lista_carrega_em_menos_de_500ms():
    page.goto('http://localhost:5173/lista')
    start = time.time()
    page.wait_for_selector('[data-testid="item-1"]')
    elapsed = time.time() - start
    assert elapsed < 0.5
```

---

## ✅ Testes pequenos e focados

Um teste deve validar **um único comportamento**:

```python
# ❌ Errado: Muitos comportamentos em um teste
def test_formulario():
    page.fill('input[name="email"]', 'test@example.com')
    page.fill('input[name="password"]', 'senha123')
    page.fill('input[name="nome"]', 'João')
    page.click('button[type="submit"]')
    assert page.url == '/dashboard'
    assert page.locator('.welcome').is_visible()
    assert page.locator('.avatar').is_visible()

# ✅ Certo: Um comportamento por teste
def test_email_obrigatorio():
    page.fill('input[name="email"]', '')
    page.click('button[type="submit"]')
    assert page.locator('.error-email').is_visible()

def test_redireciona_para_dashboard_apos_login():
    page.fill('input[name="email"]', 'test@example.com')
    page.fill('input[name="password"]', 'senha123')
    page.click('button[type="submit"]')
    page.wait_for_url('**/dashboard')
    assert page.url == '/dashboard'
```

---

## ✅ Use IA como parceira

Peça ao Claude para:
- 🤖 Gerar testes a partir de um componente
- 🤖 Sugerir edge cases
- 🤖 Criar mocks/stubs
- 🤖 Refatorar mantendo testes verdes
- 🤖 Debugar falhas de teste

**Mas sempre verifique e valide o resultado!**

---

## ✅ Confie nos testes para evoluir o design

O design emergirá naturalmente conforme os testes pedem:

```python
# Teste 1: Login básico
def test_login_valido():
    page.fill('input[name="email"]', 'user@example.com')
    page.fill('input[name="password"]', 'senha123')
    page.click('button[type="submit"]')
    page.wait_for_url('**/dashboard')

# Teste 2: Erro de validação
def test_email_invalido_mostra_erro():
    page.fill('input[name="email"]', 'invalido')
    page.fill('input[name="password"]', 'senha123')
    page.click('button[type="submit"]')
    assert page.locator('.error-message:has-text("Email inválido")').is_visible()

# Teste 3: Rate limiting
def test_rate_limit_apos_3_tentativas():
    for i in range(3):
        page.fill('input[name="email"]', 'user@example.com')
        page.fill('input[name="password"]', 'senhaerrada')
        page.click('button[type="submit"]')
        page.wait_for_timeout(500)
    
    assert page.locator('.error-message:has-text("Muitas tentativas")').is_visible()

# O design emerge: preciso de validação, feedback visual, throttling...
```

---

# 🔧 8. Identificação de Verbosidade e Over-Engineering

Antes de refatorar, identifique **o que realmente merece refatoração**.

## 🔴 5 Padrões de Alerta

### 1️⃣ Lógica Duplicada

O mesmo bloco de código (diff, validação, formatação) aparece em 2+ lugares:

```python
# ❌ Duplicado
def test_email_valido():
    email = 'user@example.com'
    assert '@' in email
    assert '.' in email.split('@')[1]

def test_email_em_formulario():
    email = 'form@example.com'
    assert '@' in email
    assert '.' in email.split('@')[1]
```

**Solução:**

```python
# ✅ Refatorado
def is_email_valid(email):
    parts = email.split('@')
    return len(parts) == 2 and '.' in parts[1]

def test_email_valido():
    assert is_email_valid('user@example.com')

def test_email_em_formulario():
    assert is_email_valid('form@example.com')
```

---

### 2️⃣ Dependências Mortas

Biblioteca instalada e configurada, mas sem ponto de uso:

```python
# ❌ Dependência não usada
import unused_library
from playwright.sync_api import sync_playwright

def test_app():
    # ... nunca usa unused_library
```

**Solução:**

```bash
pip uninstall unused_library
```

---

### 3️⃣ Wrappers Desnecessários

Componente que apenas re-renderiza um filho:

```javascript
// ❌ Wrapper inútil
function Card({ children }) {
  return <div>{children}</div>;
}

// Em seguida...
return (
  <Card>
    <p>Conteúdo</p>
  </Card>
);
```

**Solução:**

```javascript
// ✅ Use o div diretamente ou agregue valor
function Card({ children, title }) {
  return (
    <div className="card">
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}
```

---

### 4️⃣ Estilos Inline Repetidos

O mesmo objeto de estilo com 4+ atributos copiado em 10+ lugares:

```javascript
// ❌ Repetido
const buttonStyle = { padding: '8px 16px', color: '#fff', fontSize: '14px', fontWeight: 'bold' };

return (
  <>
    <button style={buttonStyle}>Enviar</button>
    <button style={buttonStyle}>Cancelar</button>
    <button style={buttonStyle}>Deletar</button>
  </>
);
```

**Solução:**

```javascript
// ✅ Constante ou classe CSS
const BUTTON_STYLE = { padding: '8px 16px', color: '#fff', fontSize: '14px', fontWeight: 'bold' };

return (
  <>
    <button style={BUTTON_STYLE}>Enviar</button>
    <button style={BUTTON_STYLE}>Cancelar</button>
    <button style={BUTTON_STYLE}>Deletar</button>
  </>
);

// Ou melhor ainda (Tailwind):
return (
  <>
    <button className="px-4 py-2 text-white font-bold text-sm">Enviar</button>
    <button className="px-4 py-2 text-white font-bold text-sm">Cancelar</button>
    <button className="px-4 py-2 text-white font-bold text-sm">Deletar</button>
  </>
);
```

---

### 5️⃣ Arquivo Monolítico

Arquivo único com +1500 linhas misturando hooks, UI, lógica de negócio:

```javascript
// ❌ Monolítico (é impossível testar unidades isoladas)
// src/pages/Dashboard.jsx (2000 linhas)
export function Dashboard() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('name');
  // ... 50+ linhas de lógica ...
  
  function fetchData() { /* ... */ }
  function formatDate() { /* ... */ }
  function validateInput() { /* ... */ }
  // ... UI ...
  return <div>...</div>;
}
```

**Solução:**

```javascript
// ✅ Estrutura modular
// src/hooks/useDashboardData.js
export function useDashboardData() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState('');
  // ...
  return { data, filter, fetchData };
}

// src/utils/formatters.js
export function formatDate(date) { /* ... */ }
export function validateInput(input) { /* ... */ }

// src/pages/Dashboard.jsx (100 linhas)
export function Dashboard() {
  const { data, filter, fetchData } = useDashboardData();
  return <DashboardView data={data} filter={filter} />;
}
```

---

## ✅ Checklist Diagnóstico

Faça estas perguntas **antes** de qualquer refatoração:

- [ ] Essa dependência é **realmente usada** em algum ponto?
- [ ] Esse bloco de código **existe em 2+ lugares** com mínimas variações?
- [ ] Esse wrapper/componente **acrescenta algo** além de passar props?
- [ ] Esse estilo inline tem **4+ atributos** repetidos **5+ vezes**?
- [ ] Esse arquivo tem **+1000 linhas** misturando responsabilidades?
- [ ] Ao escrever o teste desta função, precisei importar **coisas demais** do mesmo arquivo?

**Se respondeu SIM a qualquer pergunta → merece refatoração.**

---

## 🔁 Fluxo Recomendado de Refatoração com TDD

1. **Identificar** o problema usando o checklist
2. **Escrever teste** que valida o comportamento atual (RED do TDD)
3. **Refatorar** mantendo o teste verde (REFACTOR do TDD)
4. **Confirmar** que `pytest` ou `npm test` continua passando
5. **Commitar** como `refactor(escopo): descrição`

```bash
# Exemplo
git commit -m "refactor(dashboard): extrair hooks de useDashboardData para modularizar"
```

---

# 📋 9. Checklist Prático da Skill

Use este checklist antes de submeter qualquer feature ou refatoração:

### Desenvolvimento com TDD

- [ ] Escrevi o teste **antes** do código?
- [ ] O teste falhou primeiro? (RED ✓)
- [ ] Fiz o mínimo para passar? (GREEN ✓)
- [ ] Refatorei mantendo testes verdes? (REFACTOR ✓)
- [ ] Evitei código sem propósito?
- [ ] Os testes **comunicam** o comportamento esperado?
- [ ] Usei IA como apoio, não como autoridade?

### Qualidade de Testes

- [ ] Cada teste valida **um único comportamento**?
- [ ] Os testes cobrem **happy path + edge cases**?
- [ ] Os testes funcionam isoladamente (ordem não importa)?
- [ ] Seletores no Playwright são **estáveis** (`data-testid` preferencialmente)?

### Refatoração

- [ ] Identifiquei padrões de alerta (duplicação, wrappers, etc)?
- [ ] Escrevi testes **antes** de refatorar?
- [ ] Todos os testes continuam passando?
- [ ] Commit é **production-ready**?

---

# 🏁 Conclusão

TDD não é sobre testes. É sobre **evoluir código com segurança, confiança e rapidez**.

Combine:
- 🧪 **Testes como especificação** (antes do código)
- 🎬 **Playwright para automação real** (UI e fluxos de usuário)
- 🔄 **Refatoração contínua** (identificando e limpando dívida técnica)
- 🤖 **IA como copilota** (sugestões, edge cases, debugging)

E você terá uma base sólida para evoluir qualquer aplicação web.

---

# 📚 Referências e Exemplos

**Arquivos de exemplo disponíveis em `examples/`:**
- `element_discovery.py` - Descobrir elementos e seletores
- `static_html_automation.py` - Automação com HTML local
- `console_logging.py` - Capturar logs do console
- `e2e_test_example.py` - Teste E2E completo com TDD

**Helper Scripts em `scripts/`:**
- `with_server.py` - Gerenciar ciclo de vida do servidor
- `--help` sempre disponível para ver uso específico
