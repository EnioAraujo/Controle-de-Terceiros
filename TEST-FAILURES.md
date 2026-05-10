# Relatório de Falhas de Testes

- **Data:** 2026-05-10
- **Branch:** Main-terceiros
- **Commit (prévio):** a848692
- **Comando executado:** `pnpm test`
- **Resumo:** 214 testes executados — 212 passaram, 2 falharam (1 arquivo de teste com falhas)

## Testes com falha

- `src/pages/MobileLancamentosPage.test.tsx`
  - `exibe branding 'Controle de Terceiros'` — Erro: `getByText("Controle de")` não encontrou nó de texto. No DOM renderizado existe `<img alt="Controle de Terceiros" />` (texto no atributo `alt`, não como nó de texto).
  - `exibe badge Mobile` — Erro: `getByText("Mobile")` não encontrou nó de texto; o badge pode estar representado por ícone/atributo `title` ou o texto estar fragmentado.

## Trecho da saída (resumido)

```
FAIL src/pages/MobileLancamentosPage.test.tsx > MobileLancamentosPage (smoke)
  exibe branding 'Controle de Terceiros'
  TestingLibraryElementError: Unable to find an element with the text: Controle de

FAIL src/pages/MobileLancamentosPage.test.tsx > MobileLancamentosPage (smoke)
  exibe badge Mobile
  TestingLibraryElementError: Unable to find an element with the text: Mobile

Test Files: 1 failed | 14 passed (15)
Tests: 2 failed | 212 passed (214)
```

## Observações

- Nenhuma correção foi aplicada — conforme solicitado, apenas documentei as falhas.
- Para reproduzir localmente:

```bash
pnpm build && pnpm test
```

- Possíveis pistas para investigação (não aplicadas aqui):
  - Usar `getByAltText('Controle de Terceiros')` em vez de `getByText` quando o branding é uma imagem com `alt`.
  - Verificar onde o badge 'Mobile' deveria renderizar texto; analisar se o texto está em `title`, `aria-label` ou ausente.

## Arquivos desta ação

- `TEST-FAILURES.md` (este arquivo)
- `arquivolocal/arquivos_obrigatorios/CONTEXT.md` (histórico atualizado)

## Observação sobre o commit anterior

O relatório foi gerado após o commit `a848692` na branch `Main-terceiros` e foi adicionado ao repositório para registro.

---

Documento gerado automaticamente pelo assistente em 2026-05-10.
