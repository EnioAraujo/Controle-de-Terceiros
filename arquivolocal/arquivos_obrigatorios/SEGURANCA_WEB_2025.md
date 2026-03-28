# 🔐 Guia de Segurança para Aplicações Web — 2025/2026

> **Baseado em:** OWASP Top 10:2025 · CVEs ativos · Fóruns e publicações de segurança (Jan/2025–Mar/2026)  
> **Audiência:** Desenvolvedores full stack e equipes de AppSec  
> **Última atualização:** Março de 2026

---

## 📋 Índice

1. [OWASP Top 10:2025 — Visão Geral](#1-owasp-top-102025--visão-geral)
2. [Controle de Acesso e Autorização](#2-controle-de-acesso-e-autorização)
3. [Autenticação Segura](#3-autenticação-segura)
4. [JWT — Vulnerabilidades e Boas Práticas](#4-jwt--vulnerabilidades-e-boas-práticas)
5. [Injeção de Código (SQL, XSS, Command)](#5-injeção-de-código-sql-xss-command)
6. [HTTP Security Headers](#6-http-security-headers)
7. [Criptografia e Proteção de Dados](#7-criptografia-e-proteção-de-dados)
8. [Segurança de APIs](#8-segurança-de-apis)
9. [Gestão de Dependências e Supply Chain](#9-gestão-de-dependências-e-supply-chain)
10. [Configuração Segura de Infraestrutura](#10-configuração-segura-de-infraestrutura)
11. [Logging, Monitoramento e Resposta a Incidentes](#11-logging-monitoramento-e-resposta-a-incidentes)
12. [Tratamento de Erros e Condições Excepcionais](#12-tratamento-de-erros-e-condições-excepcionais)
13. [Zero Trust Architecture](#13-zero-trust-architecture)
14. [Checklist de Segurança — DevSecOps](#14-checklist-de-segurança--devsecops)
15. [Ferramentas Recomendadas](#15-ferramentas-recomendadas)
16. [Referências](#16-referências)

---

## 1. OWASP Top 10:2025 — Visão Geral

A edição 2025 do OWASP Top 10 foi compilada com base na análise de mais de **175.000 CVEs** e feedback de especialistas globais. Representa uma mudança de foco: de **sintomas** para **causas raiz** das vulnerabilidades.

| # | Categoria | Status vs 2021 |
|---|-----------|---------------|
| A01 | Broken Access Control | ⬆ Mantém topo |
| A02 | Security Misconfiguration | ⬆ Subiu (#5→#2) |
| A03 | Software Supply Chain Failures | 🆕 Novo (expandido de "Outdated Components") |
| A04 | Cryptographic Failures | ⬇ Caiu (#2→#4) |
| A05 | Injection | ⬇ Caiu (#3→#5) |
| A06 | Insecure Design | ⬇ Caiu (#4→#6) |
| A07 | Vulnerable Authentication | — Estável |
| A08 | Software and Data Integrity Failures | — Estável |
| A09 | Security Logging and Alerting Failures | — Estável |
| A10 | Mishandling of Exceptional Conditions | 🆕 Novo |

> ⚠️ **Destaque 2025:** SSRF (Server-Side Request Forgery) foi consolidado dentro de **A01 – Broken Access Control**, refletindo a fusão entre controles de acesso de usuário e de serviço em arquiteturas de microserviços.

---

## 2. Controle de Acesso e Autorização

**A01:2025** — É a categoria com **maior número de CWEs mapeados** (40 CWEs) e afeta praticamente todas as aplicações testadas.

### Problemas Comuns
- Privilege escalation (escalonamento de privilégios)
- Insecure Direct Object References (IDOR)
- CORS mal configurado
- Manipulação de tokens
- SSRF — Server-Side Request Forgery

### Boas Práticas

```
✅ Implementar controle de acesso server-side em TODAS as rotas
✅ Aplicar princípio do menor privilégio (Least Privilege)
✅ Política de "negar por padrão" (Deny by Default)
✅ Nunca confiar em headers encaminhados como X-User-Id de upstream
✅ Cada serviço deve validar independentemente JWT + audience claim
✅ Validar e sanitizar todas as URLs em chamadas SSRF-susceptíveis
✅ Usar allowlist para URLs externas permitidas
✅ Testar regularmente com penetration testing
```

### Configuração CORS Segura

```javascript
// ❌ ERRADO — abre para qualquer origem
app.use(cors({ origin: '*' }));

// ✅ CORRETO — apenas origens explicitamente permitidas
const allowedOrigins = ['https://app.suaempresa.com.br', 'https://admin.suaempresa.com.br'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
```

---

## 3. Autenticação Segura

**A07:2025** — Falhas de autenticação permitem ataques como credential stuffing, brute force e session hijacking.

### Boas Práticas

```
✅ Implementar MFA (Multi-Factor Authentication) obrigatório para áreas sensíveis
✅ Usar bcrypt, Argon2 ou scrypt para hashing de senhas — NUNCA MD5/SHA1 puro
✅ Definir política de senhas fortes (mín. 12 chars, variação de tipos)
✅ Implementar bloqueio progressivo após tentativas falhas (lockout/backoff)
✅ Rate limiting em endpoints de login (5-10 req/min por IP)
✅ Invalidar sessões no logout de forma completa
✅ Usar tokens de sessão com entropia suficiente (mín. 128 bits)
✅ Implementar detecção de credential stuffing (comportamento anômalo)
✅ Tokens de reset de senha devem expirar em 15-30 minutos
✅ Evitar perguntas de segurança — são inerentemente inseguras por design
```

### Hash de Senhas — Exemplo Node.js

```javascript
const bcrypt = require('bcrypt');

// ✅ Hash seguro
const SALT_ROUNDS = 12; // mínimo 10, 12+ para dados sensíveis
async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// ✅ Verificação segura (timing-safe por padrão)
async function verifyPassword(plainPassword, hash) {
  return await bcrypt.compare(plainPassword, hash);
}

// ❌ NUNCA FAÇA
// const hash = crypto.createHash('md5').update(password).digest('hex');
```

---

## 4. JWT — Vulnerabilidades e Boas Práticas

Em 2025, foram registrados **6 CVEs críticos** em implementações JWT, afetando plataformas cloud e equipamentos enterprise.

### CVEs Notáveis 2025

| CVE | Sistema Afetado | Impacto |
|-----|----------------|---------|
| CVE-2026-29000 | pac4j-jwt | CVSS 10.0 — bypass completo de autenticação |
| CVE-2025-4692 | ABUP Cloud | Escalada de privilégios via JWT malicioso |
| CVE-2025-30144 | fast-jwt | Bypass de validação do claim `iss` |
| CVE-2025-24976 | Distribution Registry | Injeção de chave de assinatura via JWK |
| CVE-2025-2079 | Optigo Networks | Segredo JWT hardcoded |
| CVE-2025-20188 | Cisco IOS XE | Segredo JWT hardcoded no firmware |

### Vulnerabilidades Clássicas

- **Algorithm Confusion:** Usar o algoritmo especificado no header sem validação (HS256 vs RS256)
- **"none" Algorithm:** Aceitar tokens com algoritmo `none` como válidos
- **Weak Secrets:** Secrets HS256 curtos, brute-forceáveis em segundos
- **Missing Claim Validation:** Não validar `exp`, `iss`, `aud`, `nbf`, `jti`
- **Insecure Storage:** Guardar JWT em `localStorage` ou `sessionStorage`

### Implementação Segura

```javascript
// ✅ Configuração segura de JWT

const jwt = require('jsonwebtoken');

// 1. Algoritmo explicitamente definido na verificação
const ALLOWED_ALGORITHMS = ['RS256', 'ES256']; // use assimétrico em produção

function verifyToken(token) {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ALLOWED_ALGORITHMS, // whitelist explícita
    issuer: 'https://auth.suaempresa.com.br',
    audience: 'https://api.suaempresa.com.br',
  });
}

// 2. Tokens de curta duração
function generateAccessToken(payload) {
  return jwt.sign(payload, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: '15m',   // access token: 5-15 minutos
    issuer: 'https://auth.suaempresa.com.br',
    audience: 'https://api.suaempresa.com.br',
    jwtid: crypto.randomUUID(), // jti único para revogação
  });
}

// 3. Cookie HttpOnly para armazenamento — NUNCA localStorage
res.cookie('access_token', token, {
  httpOnly: true,   // inacessível via JavaScript
  secure: true,     // apenas HTTPS
  sameSite: 'Strict',
  maxAge: 15 * 60 * 1000, // 15 minutos
});
```

### Revogação de Tokens (Denylist com Redis)

```javascript
const redis = require('redis');
const client = redis.createClient();

// Revogar token no logout ou atividade suspeita
async function revokeToken(jti, expiresAt) {
  const ttl = Math.floor((expiresAt * 1000 - Date.now()) / 1000);
  await client.setEx(`revoked:${jti}`, ttl, '1');
}

// Verificar revogação em cada request
async function isTokenRevoked(jti) {
  const result = await client.get(`revoked:${jti}`);
  return result !== null;
}
```

---

## 5. Injeção de Código (SQL, XSS, Command)

**A05:2025** — Injeção segue entre os mais testados, com maior número de CVEs associados (38 CWEs).

### SQL Injection

```javascript
// ❌ VULNERÁVEL
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ SEGURO — Prepared Statements / Parametrized Queries
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [email]);

// ✅ SEGURO — ORM com validação
const user = await User.findOne({ where: { email } }); // Sequelize/Prisma/TypeORM
```

### XSS (Cross-Site Scripting)

```javascript
// ❌ VULNERÁVEL — innerHTML sem sanitização
element.innerHTML = userInput;

// ✅ SEGURO — textContent (não interpreta HTML)
element.textContent = userInput;

// ✅ SEGURO — sanitização com DOMPurify quando HTML é necessário
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);

// ✅ SEGURO — output encoding no backend (ex: Handlebars, EJS)
// Sempre usar {{ variavel }} e não {{{ variavel }}} (raw)
```

### Command Injection

```javascript
// ❌ VULNERÁVEL
const { exec } = require('child_process');
exec(`convert ${userInput} output.png`);

// ✅ SEGURO — passar argumentos como array, nunca concatenar
const { execFile } = require('child_process');
execFile('convert', [userInput, 'output.png'], (err, stdout) => { ... });

// ✅ Validar input antes de qualquer uso em comandos do sistema
const sanitized = path.basename(userInput); // remove path traversal
```

### Validação de Input

```javascript
// ✅ Usar biblioteca de validação robusta (ex: Zod, Joi, Yup)
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(2).max(100).regex(/^[a-zA-ZÀ-ÿ\s'-]+$/),
  age: z.number().int().min(18).max(120),
});

// Validação server-side SEMPRE — nunca confiar apenas no client
const parsed = UserSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ errors: parsed.error.flatten() });
}
```

---

## 6. HTTP Security Headers

Os headers de segurança são a primeira linha de defesa no nível do browser. Implementar todos os abaixo é considerado prática mínima em 2025.

### Headers Essenciais

```nginx
# Nginx — Configuração de Headers de Segurança

# 1. Content Security Policy — previne XSS e injeção de recursos
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM_NONCE}';
  style-src 'self' 'nonce-{RANDOM_NONCE}' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.suaempresa.com.br;
  frame-ancestors 'none';
  form-action 'self';
  upgrade-insecure-requests;

# 2. HSTS — força HTTPS por 1 ano incluindo subdomínios
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# 3. Previne MIME sniffing
X-Content-Type-Options: nosniff

# 4. Protege contra Clickjacking
X-Frame-Options: DENY

# 5. Controla informações do Referrer
Referrer-Policy: strict-origin-when-cross-origin

# 6. Controla features do browser
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()

# 7. Remove assinatura do servidor
Server: (remover ou obscurecer)
```

### Implementação em Express.js (Node)

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.suaempresa.com.br'],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Gerar nonce único por request para CSP
app.use((req, res, next) => {
  res.locals.cspNonce = require('crypto').randomBytes(16).toString('base64');
  next();
});
```

> 💡 **Dica:** Use https://securityheaders.com para auditar os headers da sua aplicação. O score mínimo aceitável é **A**.

---

## 7. Criptografia e Proteção de Dados

**A04:2025** — Falhas criptográficas continuam entre os top 5, especialmente exposição de dados em repouso e algoritmos obsoletos.

### Regras Fundamentais

```
✅ TLS 1.2 mínimo em produção; preferir TLS 1.3
✅ Desabilitar SSLv2, SSLv3, TLS 1.0, TLS 1.1
✅ Usar AES-256-GCM para criptografia simétrica
✅ RS256 ou ES256 para JWT — NUNCA HS256 com secrets fracos
✅ PBKDF2, bcrypt ou Argon2id para derivação de chaves de senha
✅ Nunca armazenar senhas em texto plano ou com hash reversível
✅ Dados sensíveis nunca devem aparecer em logs
✅ Certificados TLS com renovação automatizada (Let's Encrypt + certbot)
✅ Implementar HSTS para forçar HTTPS
✅ Criptografar dados sensíveis em repouso no banco de dados
```

### Dados Sensíveis — O Que Nunca Fazer

```javascript
// ❌ NUNCA — hardcoded secrets
const JWT_SECRET = 'minha-senha-super-secreta';
const DB_PASSWORD = 'admin123';

// ✅ CORRETO — variáveis de ambiente + vault
const JWT_SECRET = process.env.JWT_SECRET;
// Em produção: usar AWS Secrets Manager, HashiCorp Vault, Azure Key Vault

// ❌ NUNCA — dados sensíveis em logs
console.log('Usuário logado:', { email, password, cpf });

// ✅ CORRETO — logar apenas o necessário
logger.info('Autenticação bem-sucedida', { userId: user.id, ip: req.ip });
```

### Checklist TLS/HTTPS

```
[ ] TLS 1.3 habilitado como preferido
[ ] TLS 1.0 e 1.1 desabilitados
[ ] Cipher suites fracas removidas (RC4, DES, 3DES)
[ ] Certificado válido e com renovação automática
[ ] HSTS configurado (max-age >= 6 meses)
[ ] HSTS Preload enviado para lista de browsers
[ ] OCSP Stapling habilitado
[ ] Teste em: https://www.ssllabs.com/ssltest/ (score mínimo: A)
```

---

## 8. Segurança de APIs

APIs são o vetor de ataque mais explorado em 2025. O OWASP API Security Top 10 deve ser consultado em paralelo ao Top 10 Web.

### Autenticação de API

```javascript
// ✅ OAuth 2.1 com PKCE para fluxo authorization code
// ✅ mTLS (Mutual TLS) para comunicação serviço-a-serviço
// ✅ API Keys rotacionadas regularmente — NUNCA embarcadas no frontend
// ✅ Tokens de curta duração com refresh token rotation

// Rate Limiting — express-rate-limit
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minuto
  max: 10,                  // máximo 10 tentativas
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em 1 minuto.' },
  skipSuccessfulRequests: true,
});

app.post('/auth/login', authLimiter, loginHandler);

// Rate limit geral para a API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'Rate limit excedido.' },
});

app.use('/api/', apiLimiter);
```

### Validação de Payload

```javascript
// ✅ Validar Content-Type, tamanho e estrutura
app.use(express.json({
  limit: '1mb',      // limite de payload
  strict: true,      // rejeitar valores que não são object/array
}));

// ✅ Rejeitar campos inesperados (strip extra fields)
// ✅ Validar tipagem e ranges de todos os campos
// ✅ Logar falhas de validação — padrão anômalo = possível ataque

// ✅ Headers de resposta API
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store'); // dados sensíveis nunca em cache
  next();
});
```

### CSRF Protection

```javascript
const csrf = require('csurf');

// ✅ Para aplicações com cookies de sessão
const csrfProtection = csrf({ cookie: { httpOnly: true, sameSite: 'Strict' } });

app.use(csrfProtection);

// Token disponível para o frontend via cookie ou endpoint
app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// ✅ Alternativa moderna: SameSite=Strict nos cookies de sessão
// + verificar Origin/Referer header para mutating requests
```

---

## 9. Gestão de Dependências e Supply Chain

**A03:2025** — Nova categoria que expandiu "Vulnerable and Outdated Components" para cobrir todo o ecossistema de software: dependências, build systems e distribuição.

> ⚠️ Apesar de ter a **menor incidência** nos testes, possui os **maiores scores de exploit e impacto** entre todos os CVEs mapeados.

### Riscos Principais

- Pacotes comprometidos em registries (npm, PyPI)
- Build pipelines atacados (SolarWinds-style)
- Transitive dependencies com vulnerabilidades
- Slopsquatting — pacotes falsos com nomes gerados por IA
- Dependências sem manutenção ativa

### Boas Práticas

```
✅ Usar npm audit / yarn audit regularmente (CI/CD pipeline)
✅ Implementar Software Composition Analysis (SCA) — Snyk, Dependabot
✅ Fixar versões de dependências no package-lock.json / yarn.lock
✅ Usar Subresource Integrity (SRI) para recursos CDN externos
✅ Assinar releases e artefatos de build
✅ Revisar permissões de scripts de instalação (postinstall hooks)
✅ Manter inventário de todas as dependências (SBOM — Software Bill of Materials)
✅ Monitorar avisos de segurança dos mantenedores
```

### Subresource Integrity (SRI)

```html
<!-- ✅ Carregar recurso CDN com verificação de integridade -->
<script
  src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"
  integrity="sha384-{HASH_SHA384}"
  crossorigin="anonymous">
</script>

<!-- Gerar hash: openssl dgst -sha384 -binary arquivo.js | openssl base64 -A -->
```

### Automação no CI/CD

```yaml
# GitHub Actions — verificação de segurança
- name: Audit dependencies
  run: npm audit --audit-level=high

- name: Run SAST
  uses: github/codeql-action/analyze@v3

- name: Dependency Review
  uses: actions/dependency-review-action@v4
  with:
    fail-on-severity: high
```

---

## 10. Configuração Segura de Infraestrutura

**A02:2025** — Subiu para #2. Security Misconfiguration afeta **100% das aplicações testadas** em alguma forma.

### Problemas Comuns

- Credenciais padrão não alteradas
- Mensagens de erro excessivamente detalhadas expostas ao usuário
- Funcionalidades desnecessárias habilitadas (debug, admin endpoints)
- Variáveis de ambiente sensíveis em arquivos commitados
- Permissões de arquivos/diretórios incorretas
- Portas desnecessárias abertas

### Configuração de Servidor (Nginx)

```nginx
# ✅ Remover informações de versão
server_tokens off;

# ✅ Desabilitar métodos HTTP não necessários
if ($request_method !~ ^(GET|POST|PUT|PATCH|DELETE|OPTIONS)$) {
  return 405;
}

# ✅ Limite de tamanho de upload
client_max_body_size 10M;

# ✅ Timeout para evitar Slowloris
client_body_timeout 10;
client_header_timeout 10;
keepalive_timeout 65;

# ✅ Bloquear acesso a arquivos sensíveis
location ~ /\.(env|git|htaccess|DS_Store) {
  deny all;
  return 404;
}
```

### Variáveis de Ambiente

```bash
# .gitignore — SEMPRE incluir
.env
.env.local
.env.production
*.pem
*.key
secrets/

# ✅ Usar .env.example (sem valores reais) para documentar variáveis
# ✅ Em produção: usar serviços de gerenciamento de secrets
#    - AWS Secrets Manager
#    - HashiCorp Vault
#    - Azure Key Vault
#    - Google Secret Manager
```

---

## 11. Logging, Monitoramento e Resposta a Incidentes

**A09:2025** — Falhas de logging são difíceis de detectar em testes, mas fundamentais para forensics e incident response.

### O Que Logar

```javascript
// ✅ Eventos de segurança críticos para logar
const securityEvents = [
  'login_success',
  'login_failure',
  'logout',
  'password_change',
  'password_reset_request',
  'mfa_enabled',
  'mfa_disabled',
  'permission_denied',
  'admin_action',
  'data_export',
  'token_revoked',
  'suspicious_activity',
];

// ✅ Estrutura de log de segurança
logger.warn('security_event', {
  event: 'login_failure',
  userId: null,
  email: req.body.email,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString(),
  requestId: req.id,
});
```

### O Que NUNCA Logar

```
❌ Senhas (nem hasheadas)
❌ Tokens JWT completos
❌ Números de cartão de crédito
❌ CPF / dados pessoais sensíveis
❌ Chaves de API
❌ Conteúdo de cookies de sessão
```

### Alertas e Monitoramento

```
✅ Alerta: N+ tentativas de login falhadas em X minutos (mesmo IP ou conta)
✅ Alerta: Acesso a recursos administrativos em horários incomuns
✅ Alerta: Volume anormalmente alto de requisições
✅ Alerta: Padrões de SQL injection / XSS nos logs de WAF
✅ Alerta: Tokens inválidos em alta frequência
✅ Integrar com SIEM (Security Information and Event Management)
✅ Reter logs por mínimo 90 dias (1 ano para dados regulados — LGPD/GDPR)
```

---

## 12. Tratamento de Erros e Condições Excepcionais

**A10:2025** — Categoria completamente nova, abordando improper error handling, logical errors e "failing open" — quando falhas de segurança resultam em acesso ao invés de bloqueio.

### Princípio Fundamental: Fail Secure (Fail Closed)

```javascript
// ❌ ERRADO — falhar aberto (fail open)
async function checkPermission(userId, resource) {
  try {
    return await db.checkAccess(userId, resource);
  } catch (err) {
    // Erro no banco → acesso liberado ← PERIGO!
    return true;
  }
}

// ✅ CORRETO — falhar fechado (fail closed / fail secure)
async function checkPermission(userId, resource) {
  try {
    return await db.checkAccess(userId, resource);
  } catch (err) {
    logger.error('Erro ao verificar permissão', { userId, resource, err });
    return false; // Em caso de dúvida, negar acesso
  }
}
```

### Respostas de Erro para o Usuário

```javascript
// ❌ ERRADO — vazar detalhes internos
res.status(500).json({
  error: 'PostgreSQL error: relation "users" does not exist at line 1',
  stack: err.stack,
  query: err.sql,
});

// ✅ CORRETO — mensagem genérica ao usuário + log detalhado interno
res.status(500).json({
  error: 'Erro interno. Nossa equipe foi notificada.',
  requestId: req.id, // permite rastrear no log sem expor detalhes
});

logger.error('Erro interno', { requestId: req.id, err }); // log completo apenas interno
```

### Global Error Handler (Express)

```javascript
// ✅ Handler global de erros — deve ser o último middleware
app.use((err, req, res, next) => {
  const requestId = req.id || crypto.randomUUID();
  
  // Log completo interno
  logger.error({
    requestId,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
  });

  // Resposta segura ao cliente
  const statusCode = err.status || err.statusCode || 500;
  const isOperationalError = err.isOperational === true;

  res.status(statusCode).json({
    error: isOperationalError ? err.message : 'Erro interno do servidor.',
    requestId,
  });
});
```

---

## 13. Zero Trust Architecture

O modelo Zero Trust parte do princípio **"nunca confie, sempre verifique"** — toda requisição, mesmo de dentro da rede, deve ser autenticada e autorizada.

### Princípios Core

```
1. Verificar explicitamente cada requisição (identidade, device, localização)
2. Menor privilégio possível (acesso mínimo necessário)
3. Assumir violação — estar sempre preparado para breach
4. Micro-segmentação de rede
5. Monitoramento contínuo e análise comportamental
6. Automação de resposta a incidentes
```

### Implementação em APIs

```
✅ Cada microserviço valida o JWT independentemente
✅ mTLS (Mutual TLS) para comunicação serviço-a-serviço
✅ Service mesh com autenticação automática (Istio, Linkerd)
✅ Claims de contexto no token: device_id, ip, timestamp
✅ Auditoria de todas as chamadas internas
✅ Não confiar em X-Forwarded-For, X-Real-IP sem validação da fonte
✅ Tokens de serviço com escopo limitado e expiração curta
```

---

## 14. Checklist de Segurança — DevSecOps

### Fase de Desenvolvimento

```
[ ] Validação de input implementada (server-side)
[ ] Prepared statements / ORM para todas as queries
[ ] Output encoding no template engine
[ ] Sem hardcoded secrets no código
[ ] Dependências auditadas e atualizadas
[ ] SAST integrado no editor (plugin ESLint security, Semgrep)
[ ] Code review com foco em segurança
```

### Fase de CI/CD

```
[ ] npm audit / yarn audit no pipeline
[ ] SAST (Static Application Security Testing) — CodeQL, Semgrep
[ ] SCA (Software Composition Analysis) — Snyk, Dependabot
[ ] Secret scanning — GitGuardian, truffleHog
[ ] Container scanning (se aplicável) — Trivy, Grype
[ ] IaC scanning — Checkov, tfsec
[ ] DAST em ambiente de staging — OWASP ZAP
```

### Fase de Deploy / Produção

```
[ ] TLS 1.2+ configurado (preferir TLS 1.3)
[ ] Todos os security headers implementados
[ ] Rate limiting ativo em endpoints sensíveis
[ ] WAF configurado
[ ] Logs de segurança habilitados e centralizados
[ ] Alertas de anomalia configurados
[ ] Backup e plano de disaster recovery testado
[ ] Política de rotação de secrets/chaves
[ ] Penetration test realizado
[ ] Score A em https://securityheaders.com
[ ] Score A+ em https://www.ssllabs.com/ssltest/
```

---

## 15. Ferramentas Recomendadas

### SAST (Static Analysis)

| Ferramenta | Uso | Free/Paid |
|------------|-----|-----------|
| Semgrep | Multi-linguagem, regras customizáveis | Free + Paid |
| CodeQL | GitHub, excelente para JS/TS | Free (GitHub) |
| ESLint + eslint-plugin-security | Node.js | Free |
| Bandit | Python | Free |
| SonarQube | Multi-linguagem | Community + Paid |

### DAST (Dynamic Analysis)

| Ferramenta | Uso |
|------------|-----|
| OWASP ZAP | Scanner de aplicação web — Free |
| Burp Suite | Pentest profissional — Paid |
| Nikto | Scanner de servidor web — Free |
| Nuclei | Templates de vulnerabilidades — Free |

### Dependências / SCA

| Ferramenta | Uso |
|------------|-----|
| Snyk | Dependências + containers + IaC |
| Dependabot | GitHub — PRs automáticos de update |
| OWASP Dependency-Check | Open source |
| Socket.dev | Análise comportamental de pacotes npm |

### Monitoramento e Secrets

| Ferramenta | Uso |
|------------|-----|
| GitGuardian | Detecção de secrets em repos |
| truffleHog | Scan de secrets em git history |
| HashiCorp Vault | Gerenciamento de secrets |
| Wazuh | SIEM open source |

### Auditoria de Headers / TLS

| Ferramenta | URL |
|------------|-----|
| Security Headers | https://securityheaders.com |
| SSL Labs | https://www.ssllabs.com/ssltest/ |
| Observatory (Mozilla) | https://observatory.mozilla.org |
| CSP Evaluator (Google) | https://csp-evaluator.withgoogle.com |

---

## 16. Referências

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [OWASP Application Security Verification Standard (ASVS)](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Software Assurance Maturity Model (SAMM)](https://owaspsamm.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE Top 25 Most Dangerous Software Weaknesses](https://cwe.mitre.org/top25/)
- [JWT Best Practices — RFC 8725](https://www.rfc-editor.org/rfc/rfc8725)
- [OAuth 2.1 Draft](https://oauth.net/2.1/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)

---

> 📌 **Nota:** Este documento deve ser revisado e atualizado a cada 6 meses ou após incidentes de segurança relevantes.  
> Segurança é um processo contínuo — não um estado fixo.
>
> *Gerado com base em pesquisa ativa: OWASP Top 10:2025, CVEs 2025-2026, publicações de segurança (Jan/2025–Mar/2026)*
