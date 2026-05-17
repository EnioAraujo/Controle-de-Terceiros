# Auditoria de Segurança — Maio 2026

**Data:** 2026-05-14
**Escopo:** Remediação das 21 vulnerabilidades HIGH reportadas por `pnpm audit --audit-level=high`.
**Resultado:** `pnpm audit --audit-level=high` → exit 0 (3 moderate restantes, fora de escopo).
**Validação:** 226/226 testes unitários OK, build OK, PWA gerado com regra `NetworkOnly` para Supabase preservada (LGPD).

## Estratégia

1. **Bumps top-level** para pacotes diretos quando uma versão nova resolveu transitivas.
2. **`pnpm.overrides`** condicionais para forçar transitivas em sub-árvores que o bump não alcança.
3. **`workbox-build` como devDependency direta**: a override sozinha não venceu a resolução de peer-dep do `vite-plugin-pwa` (pnpm 10.23 ignorou o override). Adicionado como dep direta para forçar `7.4.1`.

## Bumps top-level

| Pacote | Antes | Depois | Motivo |
|---|---|---|---|
| `recharts` | `^2.12.7` | `^2.15.4` | Cadeia que carrega `lodash` (bundle de produção) |
| `@vercel/node` | `^5.6.18` | `^5.8.1` | Patches em `@vercel/build-utils` e `ts-morph` |
| `eslint` | `^9.9.0` | `^9.39.4` | Suporte a `flatted` mais novo |
| `typescript-eslint` | `^8.0.1` | `^8.59.3` | Alinhamento com eslint 9.39 |
| `vite-plugin-pwa` | `^1.2.0` | `^1.3.0` | Requer `workbox-build@^7.4.1` (patches) |
| `vitest` | `^4.1.0` | `^4.1.6` | Usa `picomatch@^4.0.4` |
| `workbox-build` (novo) | — | `^7.4.1` | Workaround para override que pnpm não aplicou |

`vite` já estava em `^6.4.2` (última 6.x).

## `pnpm.overrides`

Todas condicionais — só alteram versões abaixo do floor patched.

| Pacote | Versão alvo | CVE/Advisory |
|---|---|---|
| `lodash@<4.18.0` | `^4.18.1` | `GHSA-r5fr-rjxr-66jc` (code injection em `_.template`) |
| `undici@<6.24.0` | `^6.24.0` | `GHSA-vrm6-8vpv-qv8q`, `GHSA-v9p9-hfj2-hcw8` (WebSocket) |
| `glob@<10.5.0` | `^10.5.0` | `GHSA-5j98-mcp5-4vw2` |
| `minimatch@<9.0.7` | `^9.0.9` | `GHSA-3ppc-4f35-3m26` (ReDoS) |
| `minimatch@>=10.0.0 <10.2.5` | `^10.2.5` | `GHSA-23c5-xmqv-rm74`, `GHSA-7r86-cg39-jmmj` |
| `brace-expansion@<2.0.2` | `^2.0.2` | ReDoS |
| `workbox-build` / `workbox-window` | `^7.4.1` | Cadeia `serialize-javascript`, `fast-uri`, `@babel/...` |
| `flatted@<3.4.2` | `^3.4.2` | `GHSA-25h7-pfq9-p65f`, `GHSA-rf6f-7fwh-wjgh` (proto poll.) |
| `rollup@<4.60.3` | `^4.60.3` | `GHSA-mw96-cpmx-2vgc` (path traversal) |
| `fast-uri@<3.1.2` | `^3.1.2` | `GHSA-q3j6-qgpj-74h6`, `GHSA-v39h-62p7-jpjc` |
| `@babel/plugin-transform-modules-systemjs@<7.29.4` | `^7.29.4` | `GHSA-fv7c-fp4j-7gwp` (RCE em build) |
| `serialize-javascript@<7.0.5` | `^7.0.5` | `GHSA-5c6j-r48x-rmvq` (RCE) |
| `picomatch@<4.0.4` | `^4.0.4` | `GHSA-c2c7-rcm5-vvqj` (ReDoS) |

## Riscos residuais

- **`undici` 5.x → 6.24.0**: salto de major em transitiva de `@vercel/node`. Vercel em produção usa o runtime próprio (não esse `undici`); impacto se restringe ao `vercel dev` local — não usado por este projeto.
- **`minimatch@10.x` em `@vercel/python-analysis`**: cadeia exclusiva da função serverless de análise Python (não usada por `api/admin-users.ts`).
- **3 moderate restantes**: fora de escopo desta tarefa (audit-level=high passa).
- **Pnpm override de `workbox-build` falhou silenciosamente**: motivo provável é a dupla declaração `peer + dependency` em `vite-plugin-pwa@1.3.0`. Workaround documentado acima.

## Comando de verificação

```bash
pnpm audit --audit-level=high   # exit 0
pnpm test                        # 226/226
pnpm build                       # OK
grep "NetworkOnly" dist/sw.js   # regra LGPD preservada
```
