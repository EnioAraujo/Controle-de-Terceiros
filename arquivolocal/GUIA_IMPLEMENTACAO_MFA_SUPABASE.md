# Implementação de MFA com Supabase

## Objetivo

Este documento descreve toda a configuração necessária para implementar autenticação MFA com TOTP em um projeto web usando Supabase.

O padrão descrito aqui cobre:

- Login com e-mail e senha
- Verificação MFA com TOTP
- Tela de ativação de MFA
- Códigos de recuperação de uso único
- Bloqueio de operações sensíveis para sessões sem AAL2
- Rate limit e proteção contra replay
- Auditoria dos principais eventos

A proposta é segura para produção e pode ser reutilizada em outro projeto com pequenas adaptações de rota, layout e nomes de tabela.

## Arquitetura recomendada

Fluxo geral:

1. Usuário faz login com e-mail e senha
2. Se já tiver fator TOTP verificado, o sistema exige o código MFA
3. Se ainda não tiver MFA ativo, o sistema redireciona para a tela de setup
4. Após verificar o TOTP, a sessão sobe para AAL2
5. Operações de escrita só são permitidas para sessões AAL2
6. Se o usuário perder o autenticador, pode usar um código de recuperação
7. Após uso de código de recuperação, o fator antigo deve ser invalidado e o setup refeito

## Pré-requisitos

- Projeto Supabase criado
- Autenticação por e-mail e senha habilitada
- Frontend com Supabase JS configurado
- Banco com RLS habilitado nas tabelas sensíveis
- Rotas de login e setup MFA já definidas
- Auditoria de eventos implementada ou planejada

## Variáveis de ambiente

Frontend:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Backend ou funções server-side:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ALLOWED_ORIGIN=
```

Regras:

- A anon key pode ficar no cliente
- A service role nunca deve ir para o frontend
- Toda operação administrativa com service role deve acontecer no servidor
- Restringir origem por `ALLOWED_ORIGIN` quando houver endpoint administrativo

## Configuração no Supabase Dashboard

### Authentication

Habilite:

- Email and Password
- MFA com TOTP

Revise também:

- URL de redirecionamento
- URLs permitidas para recuperação de senha
- Política de sessão
- Tempo de expiração de sessão conforme o risco do produto

### Recomendações

- Não depender apenas da tela de login para forçar MFA
- Exigir AAL2 também no banco, via RLS
- Tratar o MFA como requisito de autorização, não só de UX

## Dependências

No frontend, instale e configure:

- `@supabase/supabase-js`

Se for implementar TOTP manual fora do Supabase, considere:

- `otplib`
- `qrcode`

Com Supabase, o próprio SDK já cobre enrollment, challenge e verify de MFA.

## Cliente Supabase

Exemplo de cliente:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
```

## Banco de dados

### 1. Tabela de códigos de recuperação

Crie uma tabela para códigos de recuperação de uso único:

```sql
CREATE TABLE IF NOT EXISTS public.backup_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user_unused
  ON public.backup_codes(user_id) WHERE used_at IS NULL;

ALTER TABLE public.backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_codes_select_own"
  ON public.backup_codes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "backup_codes_insert_own"
  ON public.backup_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "backup_codes_delete_own"
  ON public.backup_codes
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 2. RPC para consumir código de recuperação

O código deve ser de uso único:

```sql
CREATE OR REPLACE FUNCTION public.use_backup_code(p_code_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.backup_codes
  WHERE user_id = auth.uid()
    AND code_hash = p_code_hash
    AND used_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.backup_codes
  SET used_at = now()
  WHERE id = v_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_backup_code(TEXT) TO authenticated;
```

### 3. Função auxiliar para checar AAL2

Essa função permite usar o nível da sessão dentro das políticas RLS:

```sql
CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'amr' @> '[{"method": "totp"}]'::jsonb)
    OR (auth.jwt() ->> 'aal') = 'aal2',
    false
  );
$$;
```

### 4. Exigir AAL2 nas tabelas sensíveis

Exemplo para uma tabela de negócio:

```sql
DROP POLICY IF EXISTS "authed_insert_registros" ON public.registros;
DROP POLICY IF EXISTS "authed_update_registros" ON public.registros;
DROP POLICY IF EXISTS "authed_delete_registros" ON public.registros;

CREATE POLICY "aal2_insert_registros"
  ON public.registros
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());

CREATE POLICY "aal2_update_registros"
  ON public.registros
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_aal2())
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());

CREATE POLICY "aal2_delete_registros"
  ON public.registros
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_aal2());
```

### 5. Exigir AAL2 mais role administrativa em tabelas críticas

Exemplo:

```sql
CREATE POLICY "aal2_admin_update_diarias_config"
  ON public.diarias_config
  FOR UPDATE
  TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin
    )
  )
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin
    )
  );
```

## Fluxo de setup MFA

### Etapas

1. Usuário autenticado entra na rota de setup MFA
2. Verificar se já existe sessão válida
3. Verificar se a sessão já está em AAL2
4. Listar fatores existentes
5. Se houver fator pendente, continuar da etapa de verificação
6. Se não houver fator, iniciar enrollment TOTP
7. Exibir QR Code
8. Usuário digita o código do app autenticador
9. Criar challenge novo
10. Verificar o código
11. Gerar códigos de recuperação
12. Exibir os códigos uma única vez
13. Confirmar que o usuário salvou os códigos

### Chamada de enrollment

```ts
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: "totp",
});
```

O retorno traz:

- `id` do fator
- `qr_code`
- `secret`

### Chamada de verificação

Sempre gere um challenge novo antes de verificar:

```ts
const { data: challenge, error: chalErr } =
  await supabase.auth.mfa.challenge({ factorId });

const { error: verErr } =
  await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: cleanCode,
  });
```

### Gerar códigos de recuperação

Recomendação adotada:

- 10 códigos
- 10 caracteres hexadecimais
- armazenados como hash
- apresentados uma única vez

Exemplo no cliente, usando hash SHA-256 vinculado ao usuário:

```ts
async function genBackupCodes(userId: string): Promise<string[]> {
  const plain: string[] = [];
  const rows: { user_id: string; code_hash: string }[] = [];

  for (let i = 0; i < 10; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    const code = Array.from(bytes, b => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    plain.push(code);

    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${userId}:${code}`)
    );

    rows.push({
      user_id: userId,
      code_hash: btoa(String.fromCharCode(...new Uint8Array(buf))),
    });
  }

  await supabase.from("backup_codes").delete().eq("user_id", userId);
  await supabase.from("backup_codes").insert(rows);

  return plain;
}
```

Observação importante:

- O ideal de segurança máxima é hashear no backend
- Se usar cliente para gerar os hashes, mantenha RLS estrita e transporte via HTTPS
- Nunca armazene o código de recuperação em texto puro no banco

## Fluxo de login com MFA

### Etapas

1. Usuário envia e-mail e senha
2. Se login falhar, registrar tentativa e aplicar bloqueio progressivo
3. Se login passar, listar fatores MFA
4. Se houver fator TOTP verificado e a sessão ainda estiver em AAL1, mostrar etapa MFA
5. Se não houver fator TOTP verificado, redirecionar para setup
6. Se a verificação MFA passar, redirecionar ao destino final
7. Se o usuário optar por recuperação, validar código de recuperação e forçar novo setup

### Descobrir se o usuário já possui MFA verificado

```ts
const { data: factors } = await supabase.auth.mfa.listFactors();

const verifiedTotp = factors?.totp?.find(
  factor => factor.factor_type === "totp" && factor.status === "verified"
);
```

### Verificar o nível atual da sessão

```ts
const { data: aal } =
  await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

if (aal?.currentLevel !== "aal2") {
  // mostrar etapa MFA
}
```

## Proteções obrigatórias

### 1. Challenge novo a cada tentativa

Não reutilize `challengeId` antigo. Gere um challenge novo em cada submit.

Motivo:

- evita challenge stale
- reduz erro 422
- evita inconsistência entre UI e estado do SDK

### 2. Proteção contra replay de TOTP

Implemente um replay guard local para rejeitar reutilização do mesmo código na mesma janela curta.

Padrão usado:

- hash do código + factorId
- TTL de 35 segundos
- armazenamento em sessionStorage

Exemplo:

```ts
const MFA_REPLAY_KEY = "mfa_replay_guard";
const MFA_REPLAY_TTL_MS = 35_000;

async function computeMfaCodeHash(code: string, factorId: string): Promise<string> {
  const data = new TextEncoder().encode(`${code}|${factorId}`);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
```

### 3. Rate limit de TOTP

Padrão mínimo recomendado:

- 5 tentativas
- janela de 60 segundos
- bloqueio temporário por 60 segundos

Exemplo de constantes:

```ts
const TOTP_MAX_ATTEMPTS = 5;
const TOTP_COOLDOWN_MS = 60_000;
```

Observação:

- Esse limite no cliente melhora UX
- O ideal é complementar com rate limit server-side quando houver backend próprio

### 4. Reautenticação para desativar MFA

Para desativar MFA, exija:

- senha atual
- TOTP atual
- sessão recente
- auditoria do evento

Se o produto tiver operações administrativas, exija AAL2 antes de permitir ações sensíveis.

### 5. Sessão parcial não pode autorizar escrita

Mesmo que o login com senha passe, uma sessão AAL1 não deve gravar dados sensíveis.

Esse ponto deve ser garantido por RLS, e não apenas pela interface.

### 6. Auditoria obrigatória

Registre ao menos os eventos:

- `MFA_ENROLL`
- `MFA_VERIFY`
- `MFA_VERIFY_FAIL`
- `MFA_SKIP`
- `BACKUP_CODE_USED`
- `MFA_UNENROLL`

## Fluxo de código de recuperação

### Quando usar

- perda do celular
- perda do autenticador
- troca de aparelho sem migração do app de MFA

### Etapas

1. Usuário escolhe usar código de recuperação
2. Informar um código salvo
3. Normalizar o valor
4. Hashear o código junto com o `userId`
5. Chamar a RPC `use_backup_code`
6. Se válido, registrar auditoria
7. Invalidar o fator atual
8. Redirecionar para novo setup MFA

Exemplo de verificação:

```ts
const raw = recoveryCode.replace(/\s/g, "").toUpperCase();

const buf = await crypto.subtle.digest(
  "SHA-256",
  new TextEncoder().encode(`${userId}:${raw}`)
);

const hash = btoa(String.fromCharCode(...new Uint8Array(buf)));

const { data: valid, error } =
  await supabase.rpc("use_backup_code", { p_code_hash: hash });

if (valid) {
  await supabase.auth.mfa.unenroll({ factorId });
  navigate("/mfa-setup", { replace: true });
}
```

## Regras de UX

### Input do TOTP

Usar:

- `type="text"`
- `inputMode="numeric"`
- `autoComplete="one-time-code"`
- comprimento lógico de 6
- placeholder `000 000`
- fonte monoespaçada
- alinhamento central

Exemplo:

```tsx
<input
  type="text"
  inputMode="numeric"
  autoComplete="one-time-code"
  placeholder="000 000"
  maxLength={6}
  aria-label="Código de verificação de 6 dígitos"
/>
```

### Input do código de recuperação

Usar:

- texto
- monoespaçado
- normalização para maiúsculas
- remoção de caracteres inválidos
- comprimento fixo

### Mensagens de erro

Preferir mensagens genéricas:

- Código inválido. Tente novamente.
- Código inválido ou expirado.
- Erro ao iniciar verificação.
- Sessão expirada.

Evitar mensagens que revelem detalhes internos da validação.

### Tela de backup codes

Oferecer:

- copiar todos
- baixar arquivo texto
- botão de confirmação de que os códigos foram salvos

Importante:

- mostrar os códigos uma única vez
- não permitir reabertura do valor em texto puro depois

## Rotas sugeridas

- `/login`
- `/mfa-setup`
- `/reset-password`

Se houver painel administrativo:

- exija AAL2 também para rotas críticas do painel
- não confie apenas em proteção de rota no frontend

## Segurança adicional recomendada

- Habilitar CSP forte
- Não expor stack traces em produção
- Usar HTTPS obrigatório
- Não logar códigos TOTP
- Não logar secrets MFA
- Não logar backup codes
- Bloquear origens indevidas em endpoints administrativos
- Exigir MFA para operações de alto impacto
- Sincronizar relógio do servidor
- Fazer limpeza de fatores órfãos quando necessário

## Casos de teste mínimos

### Setup

- cria novo fator TOTP
- exibe QR Code
- verifica código válido
- rejeita código inválido
- gera 10 backup codes
- salva hashes no banco
- exibe códigos uma única vez

### Login

- login com senha sem MFA leva ao setup
- login com MFA ativo leva à etapa TOTP
- código TOTP válido eleva a sessão para AAL2
- código inválido incrementa rate limit
- mesmo código repetido é bloqueado por replay guard
- challenge antigo não é reutilizado

### Recuperação

- código de recuperação válido é consumido uma única vez
- código de recuperação inválido falha
- após recovery, fator antigo é invalidado
- usuário é obrigado a refazer setup

### Banco e autorização

- sessão AAL1 consegue ler
- sessão AAL1 não consegue inserir, atualizar nem deletar
- sessão AAL2 consegue escrever onde a role permitir
- sessão admin sem AAL2 não executa ação administrativa crítica

## Checklist de produção

- MFA TOTP habilitado no Supabase
- Tabela `backup_codes` criada
- RPC `use_backup_code` criada
- Função `is_aal2` criada
- Políticas RLS revisadas para exigir AAL2
- Rotas de setup e login integradas
- Backup codes apresentados uma única vez
- Rate limit implementado
- Replay guard implementado
- Auditoria implementada
- Service role restrita ao backend
- Logs sensíveis removidos de produção
- Fluxo de recovery testado
- Fluxo de revogação testado
- Fluxo de troca de aparelho testado

## Decisões de segurança que valem a pena manter

- MFA como requisito de autorização, não só de interface
- Escrita bloqueada no banco para AAL1
- Backup codes de uso único
- Challenge novo por tentativa
- Replay guard curto
- Rate limit local e, se possível, server-side
- Auditoria em todos os eventos relevantes
- Reenrollment obrigatório após recovery

## Observações finais

Se você quiser um MFA realmente robusto, o ponto central não é apenas a tela de TOTP. O ponto central é este:

- o banco precisa conhecer AAL2
- as políticas RLS precisam bloquear escrita fora de AAL2
- fluxos de recuperação precisam invalidar o fator antigo
- service role nunca pode ficar no cliente