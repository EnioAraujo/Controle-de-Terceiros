# Regras de Processo — Copilot Dev

## OBRIGATÓRIO antes de qualquer alteração de código

1. **Ler `CONTEXT.md` completo** — visão geral, schema, convenções e histórico
2. **Ler `AI_RULES.md` completo** — regras de processo, stack e armadilhas
3. **Ler `DESIGN.md` completo**  — contém regras de design
4. **Ler `skill_tdd.md` completo** - contém regras de TDD
5. **Ler `skill_seguranca-webapp` completo** - contém regras de segurança

6. **Ler `README.md`


## 
Não realize update de nenhuma dependencia, feature, componente, nada, sem verificar a segurança, novas versões podem vir com bugs que por si, afetam a segurança do app contra ataques de principalmente CVSS.

## Processo a cada alteração

1. **Ler o arquivo inteiro** antes de editar qualquer trecho (nunca editar com leitura parcial)
2. **Checar props ignoradas** — buscar `_prefix` em todos os componentes modificados; se encontrar, verificar se é intencional ou bug de uso
3. **Rodar `npx tsc --noEmit`** antes de declarar qualquer alteração como concluída
4. **Rodar `pnpm build`** — o esbuild/Vite é mais estrito que o tsc e detecta erros de JSX/sintaxe que o compilador ignora
5. **Rodar `pnpm test --run`** antes de commitar — nunca commitar com testes falhando
6. **Commitar apenas após build + tsc + tests passando** — formato Conventional Commits

## Regras de Qualidade de Código

- Nunca introduzir `as any` — usar tipos explícitos; dados do Supabase DB usam `DbRegistro` de `@/lib/format-utils`
- `sanitize()` de `@/lib/audit` obrigatório em todos os campos de texto livre antes de persistir
- `logAudit()` obrigatório em INSERT, UPDATE, DELETE, PURGE
- `authReady.then()` deve envolver toda operação de escrita no Supabase
- Operações de delete + insert atômicas usam `upsert({ onConflict: "chave" })`
- `dangerouslySetInnerHTML` só aceito com `DOMPurify.sanitize()` — nunca raw
- `isAdmin` controla renderização de: seção DPO, Exclusão LGPD/titular, botão "Excluir Todos"
- TypeScript `strict: true` ativo — o compilador é a primeira linha de defesa

---

# Tech Stack

- You are building a React application.
- Use TypeScript.
- Use React Router. KEEP the routes in src/App.tsx
- Always put source code in the src folder.
- Put pages into src/pages/
- Put components into src/components/
- The main page (default page) is src/pages/Index.tsx
- UPDATE the main page to include the new components. OTHERWISE, the user can NOT see any components!
- ALWAYS try to use the shadcn/ui library.
- Tailwind CSS: always use Tailwind CSS for styling components. Utilize Tailwind classes extensively for layout, spacing, colors, and other design aspects.

Available packages and libraries:

- The lucide-react package is installed for icons.
- You ALREADY have ALL the shadcn/ui components and their dependencies installed. So you don't need to install them again.
- You have ALL the necessary Radix UI components installed.
- Use prebuilt components from the shadcn/ui library after importing them. Note that these files shouldn't be edited, so make new components if you need to change them.
