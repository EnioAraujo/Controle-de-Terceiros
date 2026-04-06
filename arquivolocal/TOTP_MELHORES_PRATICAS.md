# 🔐 Autenticação em Duas Etapas (TOTP) — Melhores Práticas

> **Padrão de referência:** RFC 6238 (TOTP) + RFC 4226 (HOTP)  
> **Algoritmo base:** HMAC-SHA1, janela de 30s, código de 6 dígitos

---

## 1. Geração e Armazenamento do Secret

| Item | ✅ Correto | ❌ Evitar |
|------|-----------|---------|
| Tamanho do secret | ≥ 160 bits (20 bytes) | Menos de 128 bits |
| Geração | `crypto.randomBytes(20)` | `Math.random()` |
| Armazenamento | Criptografado em repouso (AES-256) | Plaintext no banco |
| Encoding | Base32 (padrão TOTP) | Base64 ou hex |

```ts
// Node.js — geração segura
import crypto from 'crypto';
import base32 from 'hi-base32';

const secret = base32.encode(crypto.randomBytes(20)).replace(/=/g, '');
```

---

## 2. QR Code e Provisionamento

- URI padrão: `otpauth://totp/{issuer}:{account}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30`
- **Nunca exiba o secret em texto puro** após o primeiro setup
- Mostre o secret alternativo apenas para usuários sem app de autenticação
- Exija confirmação do código antes de ativar o 2FA

```ts
const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
```

---

## 3. Validação do Código

```ts
import { authenticator } from 'otplib';

authenticator.options = {
  window: 1,      // ±30s de tolerância (1 janela antes/depois)
  step: 30,       // Período padrão
  digits: 6,
};

const isValid = authenticator.check(userInputCode, storedSecret);
```

### Regras de validação

- **Janela de tolerância:** máximo `window: 1` (90s total). Nunca `window: 2+`
- **Rate limiting:** máximo 5 tentativas por minuto por conta — bloqueio progressivo
- **Replay attack:** registre o último código aceito e rejeite reutilização no mesmo período
- **Sincronização de relógio:** servidor deve estar sincronizado via NTP

---

## 4. Códigos de Recuperação (Backup Codes)

```ts
// Gerar 8–10 códigos únicos de uso único
const backupCodes = Array.from({ length: 10 }, () =>
  crypto.randomBytes(5).toString('hex').toUpperCase() // ex: "A3F2B9C1D4"
);

// Armazenar como hashes bcrypt — nunca em plaintext
const hashes = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 12)));
```

- Apresente **uma única vez**, com opção de download/cópia
- Invalide cada código após uso (tabela `backup_codes` com flag `used_at`)
- Notifique o usuário por e-mail quando um backup code for utilizado

---

## 5. Fluxo de Autenticação

```
[Login senha OK] → [Solicitar TOTP] → [Validar código] → [Emitir sessão]
```

- **Não crie sessão parcial** entre etapas — use token temporário assinado (JWT de curta duração, ex: 5 min)
- Separe o endpoint de validação TOTP do endpoint de login
- Registre logs de auditoria: sucesso, falha, código de backup usado

---

## 6. Enrollment (Ativação do 2FA)

```
1. Usuário solicita ativação
2. Backend gera secret → retorna QR Code
3. Usuário configura o app e digita o código gerado
4. Backend valida o código → persiste o secret criptografado
5. Backend exibe códigos de backup → usuário confirma que salvou
6. 2FA marcado como ativo
```

- O secret **não deve ser persistido** até a confirmação com código válido
- Invalidate QR Codes após 10 minutos de inatividade

---

## 7. Revogação e Desativação

- Exija reautenticação (senha + TOTP atual) para desativar o 2FA
- Ao desativar: apague o secret, invalide todos os backup codes, registre o evento em auditoria
- Ofereça fluxo de recuperação via e-mail verificado (com rate limit)

---

## 8. Considerações de UX

| Ponto | Recomendação |
|-------|-------------|
| Apps suportados | Google Authenticator, Authy, 1Password, Bitwarden |
| Mensagem de erro | "Código inválido ou expirado" (não diferenciar os casos) |
| Placeholder | `000 000` (com espaço central para legibilidade) |
| Input | `type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"` |
| Acessibilidade | `aria-label="Código de verificação de 6 dígitos"` |

---

## 9. Headers e Proteções Adicionais

```ts
// Endpoint de validação TOTP
app.post('/auth/totp/verify', [
  rateLimiter({ max: 5, windowMs: 60_000 }),
  requireTempToken,          // JWT temporário da etapa anterior
  validateTOTPInput,         // Sanitizar: apenas dígitos, length === 6
]);
```

```http
# Headers recomendados para respostas dos endpoints de auth
Cache-Control: no-store
Pragma: no-cache
```

---

## 10. Checklist de Segurança

- [ ] Secret ≥ 160 bits, gerado com CSPRNG
- [ ] Secret criptografado em repouso (AES-256)
- [ ] Janela de tolerância máxima: `window: 1`
- [ ] Proteção contra replay (último código aceito registrado)
- [ ] Rate limiting no endpoint de validação
- [ ] Backup codes armazenados como hash (bcrypt/argon2)
- [ ] Backup codes de uso único
- [ ] Token temporário entre etapas (sem sessão parcial)
- [ ] Logs de auditoria para todos os eventos de 2FA
- [ ] NTP sincronizado no servidor
- [ ] Reautenticação exigida para desativar 2FA
- [ ] `autocomplete="one-time-code"` no input

---

## Bibliotecas Recomendadas

| Linguagem | Biblioteca |
|-----------|-----------|
| Node.js / TypeScript | `otplib` |
| Python | `pyotp` |
| Go | `pquerna/otp` |
| Java | `GoogleAuth` / `java-otp` |
| PHP | `sonata-project/google-authenticator` |

---

*Referências: [RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238) · [OWASP MFA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) · [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html)*
