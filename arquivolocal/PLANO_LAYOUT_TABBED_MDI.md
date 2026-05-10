# Plano: Migração para Tabbed MDI estilo VS Code

## Context
Layout atual usa sidebar larga (AppSidebar) + conteúdo único visível. O objetivo é migrar para shell estilo VS Code: Activity Bar estreita (ícones) + TabBar horizontal (abas abertas) + StatusBar no rodapé. Não toca em nenhum componente de feature.

---

## Layout alvo

```
┌──────┬─────────────────────────────────────────┐
│  48px│ [Tab: Dashboard ×] [Tab: Lancamentos ×] │  ← TabBar (36px)
│      ├─────────────────────────────────────────┤
│  Act │                                         │
│  ivi │         Área de Conteúdo                │  ← content 1fr
│  ty  │                                         │
│  Bar │                                         │
│      ├─────────────────────────────────────────┤
│      │ ● Conectado  Hoje:3  Mês:12   14:35 ↩  │  ← StatusBar (24px)
└──────┴─────────────────────────────────────────┘
```

CSS Grid: `grid-template-areas: "activity tabs" / "activity content" / "status status"`
`grid-template-columns: 48px 1fr` | `grid-template-rows: 36px 1fr 24px`

---

## Arquivos a CRIAR

### 1. `src/hooks/useTabManager.ts` (~50 linhas)
- Estado: `openTabs: TabId[]`, `activeTab: TabId`
- `openTab(id)` — adiciona se ausente, ativa
- `closeTab(id)` — remove, ativa vizinho mais próximo; impede fechar última aba
- `setActiveTab(id)` — só troca ativo

### 2. `src/components/layout/ActivityBar.tsx` (~80 linhas)
Props: `items`, `activeTabId`, `openTabs`, `onOpen(id)`, `isAdmin`, `onAdmin`, `onMobile`, `onLogout`
- Logo no topo (34×34px)
- Botão por módulo: ícone + tooltip (`title=`) + indicador laranja na esquerda quando ativo
- Rodapé: admin (condicional), mobile switch, logout
- Background `#212B36`, largura `48px`

### 3. `src/components/layout/TabBar.tsx` (~80 linhas)
Props: `tabs: {id, label, icon}[]`, `activeId`, `onActivate(id)`, `onClose(id)`
- Scroll horizontal se overflow
- Aba ativa: `border-bottom: 2px solid #F37E38` + bg levemente mais claro
- Botão × por aba; ícone + label (12px Inter)
- Background `#1A2430` (um tom abaixo de `#212B36`)

### 4. `src/components/layout/StatusBar.tsx` (~60 linhas)
Props: `loading`, `saved`, `hoje_`, `mes_`, `lang`
- Esquerda: ponto verde + "Conectado", spinner se loading, "Salvo" se saved
- Centro: `Hoje: N  Mês: N`
- Direita: horário DM Mono, atualizado a cada minuto via `useState` + `setInterval`
- Background `#111820`, altura `24px`, font-size `11px`

---

## Arquivos a MODIFICAR

### 5. `src/components/layout/AppShell.tsx`
Substituir interface e grid. Props novas:
```typescript
type AppShellProps = {
  activityBar: ReactNode;
  tabBar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
  mobileTopBar?: ReactNode;  // mantido para mobile
};
```
Grid CSS inline com as 4 áreas. Preservar classes `rsp-*` para mobile.

### 6. `src/pages/Index.tsx`
- Importar `useTabManager`, `ActivityBar`, `TabBar`, `StatusBar`
- Remover import de `AppSidebar`
- Passar `openTab` como handler no `ActivityBar` (em vez de `setTab` direto)
- Renderizar `<AppShell activityBar={…} tabBar={…} statusBar={…}>`
- Footer JSX (linhas 108-154) migra para `ActivityBar` + `StatusBar` via props
- Manter todo estado existente (useStorage, useOpcoes, isAdmin, saved, etc.)
- Estimativa: fica em ~170 linhas (abaixo do limite de 200)

---

## Arquivos a DELETAR

- `src/components/layout/AppSidebar.tsx` — substituído por `ActivityBar.tsx`
  - Verificar antes: `grep -r "AppSidebar" src/` deve retornar apenas Index.tsx

---

## Arquivos NÃO tocados

Todos os componentes de feature: `Dashboard`, `Lancamentos`, `ProjecaoPage`, `FechamentoTab`, `Configuracoes`, `FormLancamento` e todo `src/components/fechamento/`, `src/components/configuracoes/`.

Infraestrutura: `App.tsx`, `main.tsx`, `src/lib/*`, `src/hooks/useStorage.ts`, `src/hooks/useOpcoes.ts`, `src/types/`, `src/components/ui/`, `src/components/atoms.tsx`, `globals.css`, `vercel.json`.

---

## Regras respeitadas

- Zero `as any`; todos os props com tipos explícitos
- Sem lógica de negócio em componentes de UI (layout puro)
- Nenhum componente ultrapassa ~200 linhas
- Mobile: `mobileTopBar` preservado no AppShell; layout desktop ativado via classe CSS (não media query no JS)
- Design tokens existentes: `#212B36`, `#F37E38`, `#FAF9FB`, font DM Mono para tempo

---

## Verificação

1. `pnpm tsc --noEmit` — zero erros
2. `pnpm build` — build limpo
3. `pnpm test --run` — 189+ testes passando
4. Verificar visualmente: abrir app, clicar módulos na ActivityBar, ver abas abrirem no TabBar, fechar abas, StatusBar mostra status correto

---

## Estimativa de impacto

| Ação | Arquivos |
|------|----------|
| Criar | 4 |
| Modificar | 2 |
| Deletar | 1 |
| **Total impactado** | **7** |

**Riscos:**
- Classes `rsp-*` em `globals.css` — verificar antes de trocar AppShell para não quebrar mobile
- `mobileTopBar` deve continuar funcionando (Index.tsx ainda o passa para AppShell)
- AppSidebar pode ter outros importadores — confirmar grep antes de deletar
