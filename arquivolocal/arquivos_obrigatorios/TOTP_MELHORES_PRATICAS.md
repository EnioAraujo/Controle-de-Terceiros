# 🔐 Autenticação em Duas Etapas (TOTP) — Melhores Práticas

> **Padrões de referência:** RFC 6238 (TOTP) · RFC 4226 (HOTP) · NIST SP 800-63B-4 (jul/2025) · OWASP MFA Cheat Sheet
> **Algoritmo base:** HMAC-SHA1, janela de 30s, código de 6 dígitos
> **Última atualização:** Maio de 2026

---

## ⚠️ Aviso importante sobre TOTP em 2026

NIST SP 800-63B-4 (publicado em 31/jul/2025) e CISA classificam TOTP como **não phishing-resistant**. Para AAL2, o sistema **deve oferecer** uma opção phishing-resistant (FIDO2/WebAuthn/passkeys); para AAL3, ela é **obrigatória**.

**Recomendação prática para 2026:**
- ✅ **Use TOTP** como segundo fator para usuários comuns (consumer apps, dashboards internos sem dados ultrassensíveis)
- ✅ **Adicione passkeys (WebAuthn)** como opção preferencial — mais segura e melhor UX
- ❌ **NÃO use TOTP/SMS/push como único MFA** em fluxos de alto risco (admin, financeiro, dados de saúde, contratos)
- ⚠️ **Evite SMS** sempre que possível (SIM-swap, SS7) — TOTP é estritamente superior

Esta skill cobre TOTP de forma completa porque ele continua sendo o padrão dominante em SaaS, mas trate-o como **camada base**, não como controle de elite.

---

## 1. Geração e Armazenamento do Secret

| Item | ✅ Correto | ❌ Evitar |
|------|-----------|---------|
| Tamanho do secret | ≥ 160 bits (20 bytes) — RFC 6238 | Menos de 128 bits |
| Geração | `crypto.randomBytes(20)` (CSPRNG) | `Math.random()`, timestamp, hash de email |
| Armazenamento | Criptografado em repouso (AES-256-GCM) ou KMS-wrapped | Plaintext no banco, base64 simples |
| Encoding (transporte) | Base32 sem padding (padrão TOTP) | Base64 ou hex |
| Rotação | Suportar regeneração via fluxo autenticado | Secret imutável por toda a vida da conta |

```ts
// Node.js — geração segura
import crypto from 'crypto';
import base32 from 'hi-base32';

const secret = base32.encode(crypto.randomBytes(20)).replace(/=/g, '');
```

**Criptografia em repouso (Postgres + pgcrypto / Supabase):**

```sql
-- Coluna de secret cifrado com KMS-derived key
ALTER TABLE user_mfa
  ADD COLUMN totp_secret_encrypted bytea NOT NULL,
  ADD COLUMN totp_key_version int NOT NULL DEFAULT 1;

-- Nunca exponha o secret por SELECT direto: use uma function SECURITY DEFINER
-- que decifra apenas no momento da verificação e em RAM.
```

---

## 2. QR Code e Provisionamento

- URI padrão (otpauth):
  ```
  otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30
  ```
- **Nunca exiba o secret em texto puro** após o primeiro setup
- Mostre o secret alternativo apenas para usuários sem app autenticador (ainda assim, em UI dedicada com `Cache-Control: no-store`)
- Exija confirmação do código antes de ativar o 2FA (enrollment não pode ser concluído sem prova de posse)
- O QR Code deve ter TTL curto (≤ 10 min) e ser **invalidado após uso ou ao recarregar a página**

```ts
const issuer = encodeURIComponent('Supporte');
const account = encodeURIComponent(user.email);
const uri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

// Servir o QR como SVG inline ou PNG efêmero (sem cache, sem CDN, sem logs do servidor)
res.setHeader('Cache-Control', 'no-store');
res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:;");
```

---

## 3. Validação do Código

```ts
import { authenticator } from 'otplib';

authenticator.options = {
  window: 1,      // ±30s de tolerância (1 janela antes/depois)
  step: 30,       // Período padrão RFC 6238
  digits: 6,
  algorithm: 'sha1', // 'sha256' opcionalmente, mas a maioria dos apps autenticadores usa SHA1
};

const isValid = authenticator.check(userInputCode, storedSecret);
```

### Regras de validação (NIST SP 800-63B-4 §3.1.4)

| Regra | Requisito | Por quê |
|------|-----------|---------|
| Janela de tolerância | máximo `window: 1` (±30s, total 90s) | Reduz superfície para brute force online |
| Rate limiting | máx **5 tentativas** consecutivas falhas por conta — bloqueio progressivo | NIST exige; previne brute force ativo |
| Replay protection | registrar último código aceito + timestamp; rejeitar reuso na mesma janela | RFC 6238 §5.2 |
| Sincronização de relógio | servidor com NTP válido (drift < 1s) | Janelas falsas causam falha de UX |
| Comparação de strings | timing-safe (`crypto.timingSafeEqual`) | Previne timing oracle em `===` |
| Tamanho do código | exatamente 6 dígitos numéricos | Validar antes de invocar a lib (evita ReDoS / payload anômalo) |

```ts
// Validação completa com replay protection
async function verifyTOTP(userId: string, code: string): Promise<boolean> {
  // 1. Sanitização de entrada
  if (!/^\d{6}$/.test(code)) return false;

  // 2. Rate limiting (Redis + sliding window)
  const attempts = await redis.incr(`totp:attempts:${userId}`);
  if (attempts === 1) await redis.expire(`totp:attempts:${userId}`, 60);
  if (attempts > 5) {
    await logSecurityEvent('totp_rate_limit_exceeded', { userId });
    throw new AuthError('Too many attempts');
  }

  // 3. Replay protection
  const lastUsed = await redis.get(`totp:lastcode:${userId}`);
  if (lastUsed === code) return false;

  // 4. Verificação
  const secret = await decryptSecret(userId);
  const valid = authenticator.check(code, secret);

  // 5. Persistir o último código aceito (TTL = janela de validade)
  if (valid) {
    await redis.setEx(`totp:lastcode:${userId}`, 90, code);
    await redis.del(`totp:attempts:${userId}`);
  }

  return valid;
}
```

---

## 4. Códigos de Recuperação (Backup Codes)

```ts
// Gerar 8–10 códigos únicos de uso único
const backupCodes = Array.from({ length: 10 }, () =>
  crypto.randomBytes(5).toString('hex').toUpperCase() // ex: "A3F2B9C1D4"
);

// Armazenar como hashes Argon2id (preferido) ou bcrypt — nunca em plaintext
import * as argon2 from 'argon2';

const hashes = await Promise.all(
  backupCodes.map(c => argon2.hash(c, {
    type: argon2.argon2id,
    memoryCost: 19456,  // 19 MiB (OWASP 2025 mínimo)
    timeCost: 2,
    parallelism: 1,
  }))
);
```

**Regras (NIST SP 800-63B-4 §3.1.2 — Look-up Secrets):**

- Apresente **uma única vez**, com opção de download/cópia
- Cada código tem ≥ 64 bits de entropia (10 chars hex = 40 bits — considere aumentar para 12+ chars)
- Invalide cada código após uso (tabela `backup_codes` com flag `used_at` + `used_from_ip`)
- Notifique o usuário por e-mail quando um backup code for utilizado (com link "não fui eu")
- Permita regenerar o conjunto inteiro (invalida todos os anteriores) — exigir reautenticação

```sql
CREATE TABLE backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  used_from_ip inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_use_only CHECK (used_at IS NULL OR used_from_ip IS NOT NULL)
);

CREATE INDEX idx_backup_codes_user_unused ON backup_codes(user_id) WHERE used_at IS NULL;
```

---

## 5. Fluxo de Autenticação

```
[Login senha OK] → [Token temp 5min] → [Validar TOTP] → [Emitir sessão real]
```

- **Não crie sessão parcial** entre etapas — use token temporário assinado (JWT curto, 5 min, com claim `mfa_pending: true`)
- Separe o endpoint de validação TOTP do endpoint de login (`POST /auth/login` vs `POST /auth/mfa/verify`)
- Registre logs de auditoria: sucesso, falha, código de backup usado, regeneração de secret, desativação

```ts
// Após senha correta — emite token de etapa intermediária
const tempToken = await new SignJWT({
  sub: user.id,
  purpose: 'mfa_verification',
  step: 'awaiting_totp',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('5m')
  .setJti(crypto.randomUUID())
  .sign(secret);

return { mfaRequired: true, tempToken };
```

---

## 6. Enrollment (Ativação do 2FA)

```
1. Usuário autenticado solicita ativação (precisa estar logado, com senha recente — re-auth ≤ 10min)
2. Backend gera secret + URI → retorna QR Code (sem persistir secret ainda)
3. Usuário escaneia, app gera código, usuário digita
4. Backend valida o código contra o secret pendente
5. Se válido: persiste secret cifrado + ativa 2FA + gera backup codes
6. Exibe backup codes UMA ÚNICA VEZ → usuário confirma "salvei meus códigos"
7. Envia e-mail de confirmação ao usuário ("2FA foi ativado em sua conta")
```

**Regras críticas:**
- O secret **NÃO deve ser persistido** até a confirmação com código válido (mantenha em Redis com TTL 10min)
- Após sucesso: invalidar todas as outras sessões do usuário (force re-login com 2FA)
- Logar o evento `mfa_enabled` com IP, user agent, timestamp

```ts
// Setup pendente em Redis (não persiste no banco até confirmação)
async function startTOTPEnrollment(userId: string) {
  const secret = base32.encode(crypto.randomBytes(20)).replace(/=/g, '');
  const enrollmentId = crypto.randomUUID();

  await redis.setEx(
    `mfa:enrollment:${enrollmentId}`,
    600, // 10 min
    JSON.stringify({ userId, secret })
  );

  const uri = buildOtpAuthUri(secret, user.email, 'Supporte');
  return { enrollmentId, qrCodeUri: uri };
}

async function confirmTOTPEnrollment(enrollmentId: string, code: string) {
  const data = await redis.get(`mfa:enrollment:${enrollmentId}`);
  if (!data) throw new AuthError('Enrollment expired');

  const { userId, secret } = JSON.parse(data);
  if (!authenticator.check(code, secret)) {
    throw new AuthError('Invalid code');
  }

  // Só agora persiste no banco
  await db.userMfa.create({
    userId,
    totpSecretEncrypted: encrypt(secret),
    enabledAt: new Date(),
  });

  await redis.del(`mfa:enrollment:${enrollmentId}`);
  await invalidateAllSessions(userId);
  await sendEmail(userId, 'mfa_enabled_notification');
}
```

---

## 7. Revogação e Desativação

- Exija **reautenticação** (senha + TOTP atual) para desativar o 2FA
- Ao desativar: apague o secret, invalide todos os backup codes, registre o evento em auditoria
- Notifique o usuário por e-mail (com link "não fui eu" para acionar suporte)
- Ofereça fluxo de recuperação via e-mail verificado (com rate limit + delay obrigatório de 24-48h em contas críticas)

```ts
async function disableMFA(userId: string, currentPassword: string, currentTOTP: string) {
  // 1. Re-verificar senha (timing-safe)
  if (!await verifyPassword(userId, currentPassword)) throw new AuthError();

  // 2. Re-verificar TOTP atual
  if (!await verifyTOTP(userId, currentTOTP)) throw new AuthError();

  // 3. Apagar tudo
  await db.userMfa.delete({ userId });
  await db.backupCodes.deleteMany({ userId });

  // 4. Auditoria + notificação
  await logSecurityEvent('mfa_disabled', { userId });
  await sendEmail(userId, 'mfa_disabled_notification');

  // 5. Force re-login
  await invalidateAllSessions(userId);
}
```

---

## 8. Considerações de UX

| Ponto | Recomendação |
|-------|-------------|
| Apps suportados | Google Authenticator, Authy, 1Password, Bitwarden, Aegis (Android), Raivo (iOS) |
| Mensagem de erro | "Código inválido ou expirado" — **não diferenciar** os casos (previne user enumeration) |
| Placeholder | `000 000` (com espaço central para legibilidade) |
| Input | `type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code"` |
| Acessibilidade | `aria-label="Código de verificação de 6 dígitos"` + `aria-describedby` para a mensagem de erro |
| Auto-submit | Submeter automaticamente quando 6 dígitos forem digitados (melhora UX significativamente) |
| Mobile | Suporte a colar (paste) — usuários copiam código do app autenticador |
| Sensibilidade ao tempo | Mostrar contador regressivo da janela atual ("código expira em 12s") |

```html
<input
  type="text"
  inputmode="numeric"
  pattern="[0-9]*"
  maxlength="6"
  autocomplete="one-time-code"
  aria-label="Código de verificação de 6 dígitos"
  aria-describedby="totp-error"
  placeholder="000 000"
  autofocus
/>
<span id="totp-error" role="alert"></span>
```

---

## 9. Headers e Proteções Adicionais

```ts
// Endpoint de validação TOTP — pipeline completo
app.post('/auth/totp/verify', [
  rateLimiter({ max: 5, windowMs: 60_000, keyGenerator: req => req.tempToken.sub }),
  requireTempToken,          // JWT temporário da etapa anterior, com claim mfa_pending
  validateTOTPInput,         // Sanitizar: apenas dígitos, length === 6
  csrfProtection,            // Mesmo em fluxos com cookie httpOnly
  preventReplay,             // Verificar último código aceito
]);
```

```http
# Headers obrigatórios em respostas de endpoints de auth
Cache-Control: no-store
Pragma: no-cache
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'; script-src 'self'
Referrer-Policy: no-referrer
```

---

## 10. Integração com WebAuthn / Passkeys (recomendado para 2026)

NIST SP 800-63B-4 incentiva a oferta de passkeys como opção primária. Estrutura recomendada:

```
[Login senha] → [Sistema oferece]:
                   ├─ Passkey (preferido — phishing-resistant) → autenticação imediata
                   ├─ TOTP (backup confiável)
                   └─ Backup code (último recurso)
```

```ts
// Schema de banco que suporta múltiplos métodos por usuário
CREATE TABLE user_authenticators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('totp', 'webauthn', 'backup_code')),
  -- Para TOTP:
  totp_secret_encrypted bytea,
  -- Para WebAuthn:
  webauthn_credential_id bytea,
  webauthn_public_key bytea,
  webauthn_aaguid uuid,           -- modelo do authenticator (FIDO MDS)
  webauthn_sign_count bigint DEFAULT 0,
  webauthn_is_syncable boolean,   -- syncable passkey ou hardware-bound
  -- Comum:
  label text,                     -- "iPhone 15", "YubiKey azul"
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
```

> 📌 Para AAL3 (admin, dados regulados), exija passkey hardware-bound (não syncable). Bibliotecas: [`@simplewebauthn/server`](https://simplewebauthn.dev/) (Node), [`webauthn4j`](https://webauthn4j.github.io/) (Java).

---

## 11. Checklist de Segurança

### Implementação
- [ ] Secret ≥ 160 bits, gerado com CSPRNG (`crypto.randomBytes`, não `Math.random`)
- [ ] Secret criptografado em repouso (AES-256-GCM ou KMS-wrapped)
- [ ] Janela de tolerância máxima: `window: 1` (±30s)
- [ ] Proteção contra replay (último código aceito registrado em Redis)
- [ ] Comparação timing-safe de strings de código
- [ ] Rate limiting no endpoint de validação (≤ 5 tentativas/min)
- [ ] Backup codes armazenados como hash (Argon2id ou bcrypt)
- [ ] Backup codes de uso único (flag `used_at`)
- [ ] Token temporário entre etapas (JWT 5min, claim `mfa_pending`)
- [ ] Input validado: `^\d{6}$` antes de invocar a lib

### Operação
- [ ] Logs de auditoria para todos os eventos: `enabled`, `disabled`, `verify_success`, `verify_fail`, `backup_code_used`, `regenerated`
- [ ] NTP sincronizado no servidor (drift < 1s)
- [ ] Reautenticação exigida para desativar 2FA
- [ ] Notificação por e-mail em eventos críticos (ativação, desativação, backup code usado)
- [ ] `autocomplete="one-time-code"` no input
- [ ] Headers `Cache-Control: no-store` em todos os endpoints de auth
- [ ] Suporte a múltiplos authenticators por usuário (passkey + TOTP)

### NIST SP 800-63B-4 compliance (AAL2)
- [ ] Sistema oferece **alguma opção phishing-resistant** (passkey/WebAuthn) além do TOTP
- [ ] Recovery flow não rebaixa AAL (não permite reset por SMS se conta usa passkey)
- [ ] Reauth obrigatório para mudanças sensíveis (mudar senha, mudar e-mail, mudar 2FA)
- [ ] Session timeout: 12h reauth para AAL2, 30min idle

---

## 12. Bibliotecas Recomendadas (2026)

| Linguagem | Lib TOTP | Lib WebAuthn |
|-----------|----------|--------------|
| Node.js / TypeScript | `otplib` | `@simplewebauthn/server` |
| Python | `pyotp` | `webauthn` (duo-labs/py_webauthn) |
| Go | `pquerna/otp` | `go-webauthn/webauthn` |
| Java | `java-otp` | `webauthn4j` |
| Rust | `totp-rs` | `webauthn-rs` |
| PHP | `spomky-labs/otphp` | `web-auth/webauthn-lib` |
| .NET | `Otp.NET` | `Fido2NetLib` |

---

## 13. Vetores de ataque conhecidos contra TOTP (referência)

| Ataque | Como funciona | Mitigação |
|--------|---------------|-----------|
| Adversary-in-the-Middle (AiTM) | Proxy reverso captura senha + TOTP em tempo real e replay no site real | Passkey/FIDO2 (origin-bound). TOTP é vulnerável por design |
| Brute force online | Tentar todos os 10⁶ códigos em janelas | Rate limit (≤ 5/min), bloqueio progressivo |
| Replay attack | Reusar código capturado no mesmo período de 30s | Registrar último código aceito |
| Phishing kit moderno (Evilginx, Modlishka) | Captura código TOTP em tempo real | Educação + transição para passkey |
| Vazamento do secret no banco | Atacante extrai secret e gera códigos válidos | Cifrar com KMS, não com chave estática |
| SIM-swap (não aplicável a TOTP, mas relevante p/ recovery) | Atacante toma o número de telefone | Não usar SMS como fallback |
| Time-skew exploitation | Servidor com relógio fora do NTP aceita códigos antigos | Monitorar drift do NTP |

---

## 14. Quando NÃO usar apenas TOTP

| Cenário | Recomendação |
|---------|--------------|
| Acesso admin a sistemas de produção | Passkey hardware-bound obrigatório |
| Movimentação financeira > R$ 10k | Passkey + step-up + delay |
| Dados de saúde / LGPD dados sensíveis | Passkey ou WebAuthn (AAL3) |
| Mudança de e-mail/senha/2FA | Reauth com TOTP atual + delay 24h em contas críticas |
| Acesso a dados de outros usuários (CRM, suporte) | Passkey + audit log obrigatório por ação |
| Impersonation / "login as user" | Passkey + aprovação humana de segundo admin |

---

*Referências:*
- [RFC 6238 — TOTP](https://datatracker.ietf.org/doc/html/rfc6238)
- [RFC 4226 — HOTP](https://datatracker.ietf.org/doc/html/rfc4226)
- [NIST SP 800-63B-4 (final, jul/2025)](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [OWASP MFA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [WebAuthn Level 3 — W3C](https://www.w3.org/TR/webauthn-3/)
- [FIDO Metadata Service](https://fidoalliance.org/metadata/)
- [CISA — Phishing-Resistant MFA](https://www.cisa.gov/sites/default/files/publications/fact-sheet-implementing-phishing-resistant-mfa-508c.pdf)

---

> 📌 Este documento deve ser revisado a cada 6 meses ou após mudanças nas RFCs/NIST.
> *Versão 2026.05 — atualizado com NIST SP 800-63B-4 final, integração com passkeys, replay protection detalhada.*
