# Plano: Migrar AdminPage e MobileLancamentosPage para layout MDI

## Context

Index.tsx já usa o layout VS Code-style (ActivityBar + TabBar + StatusBar). AdminPage ainda usa AppShell no modo sidebar (AppSidebar) com shadcn Tabs. MobileLancamentosPage usa layout 100% customizado (header sticky + bottom tab bar). Objetivo: aplicar o mesmo shell MDI às duas páginas restantes.

---

## Layout alvo (mesmo de Index.tsx)

```
┌──────┬─────────────────────────────────────┐
│ 48px │ [Tab: Seção A ×] [Tab: Seção B ×]  │  ← TabBar (36px)
│      ├─────────────────────────────────────┤
│ Act  │                                     │
│ ivi  │         Área de Conteúdo            │
│ ty   │                                     │
│ Bar  ├─────────────────────────────────────┤
│      │ ● Conectado             14:35       │  ← StatusBar (24px)
└──────┴─────────────────────────────────────┘
```

---

## Arquivos a CRIAR

Nenhum. Todos os componentes de layout já existem.

---

## Arquivos a MODIFICAR

### 1. `src/components/layout/ActivityBar.tsx` (+~12 linhas)

Adicionar prop opcional `onBack?: () => void` + `backLabel?: string` (default `"Voltar"`).
Renderizar botão de voltar no rodapé (antes do logout), com ícone ChevronLeft SVG.

> Necessário porque AdminPage precisa de "Voltar ao App" e MobileLancamentosPage precisa de "Desktop".
> Prop é opcional — comportamento de Index.tsx inalterado.

---

### 2. `src/pages/AdminPage.tsx` (~40 linhas alteradas de 1056)

**Remover imports:**
- `AppSidebar`, `AppSidebarItem` de `@/components/layout/AppSidebar`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` do shadcn

**Adicionar imports:**
- `useTabManager` de `@/hooks/useTabManager`
- `ActivityBar`, `ActivityItem` de `@/components/layout/ActivityBar`
- `TabBar` de `@/components/layout/TabBar`
- `StatusBar` de `@/components/layout/StatusBar`

**Estado:**
```ts
// antes
const [activeTab, setActiveTab] = useState<AdminTab>("usuarios");

// depois
const { openTabs, activeTab, openTab, setActiveTab } = useTabManager<AdminTab>("usuarios");
```

**Nav items:** mudar tipo de `AppSidebarItem[]` → `ActivityItem[]` (mesmo shape `{id, label, icon}`).

**AppShell wrapper** (substituir sidebar mode por MDI mode):
```tsx
// antes
<AppShell sidebar={<AppSidebar items={adminNav} activeItemId={activeTab} onItemClick={...} ... />} mobileTopBar={...}>

// depois
<AppShell
  activityBar={
    <ActivityBar
      items={adminNav}
      activeId={activeTab}
      onOpen={(id) => openTab(id as AdminTab)}
      brandImageSrc="/admin.png"
      brandImageAlt="Administração"
      onBack={() => navigate("/")}
      backLabel={t("admin_back_app")}
      onLogout={() => supabase.auth.signOut()}
      logoutLabel={t("nav_logout")}
    />
  }
  tabBar={
    <TabBar
      tabs={openTabs.map(id => adminNav.find(n => n.id === id)!)}
      activeId={activeTab}
      onActivate={(id) => setActiveTab(id as AdminTab)}
      onClose={(id) => closeTab(id as AdminTab)}
    />
  }
  statusBar={<StatusBar loading={false} saved={false} hojeCount={0} mesCount={0} lang={lang} />}
  mobileTopBar={/* manter o mobileTopBar atual inalterado */}
>
```

**Tabs → conditional rendering:**
```tsx
// antes: <Tabs><TabsList>...</TabsList><TabsContent value="usuarios">...</TabsContent>...</Tabs>
// depois:
<div className="space-y-6">
  {activeTab === "usuarios" && <div>{/* conteúdo usuarios intacto */}</div>}
  {activeTab === "permissoes" && <div>{/* conteúdo permissoes intacto */}</div>}
  {activeTab === "conta" && <div>{/* conteúdo conta intacto */}</div>}
</div>
```

**Todo conteúdo interno de cada tab: inalterado.**

---

### 3. `src/pages/MobileLancamentosPage.tsx` (~80 linhas alteradas de 1008)

**Adicionar imports:**
- `useTabManager`, `ActivityBar`, `TabBar`, `StatusBar`, `AppShell`

**Estado:**
```ts
// antes
const [activeTab, setActiveTab] = useState<"lancamentos" | "configuracoes">("lancamentos");

// depois
type MobileTab = "lancamentos" | "configuracoes";
const { openTabs, activeTab, openTab, setActiveTab } = useTabManager<MobileTab>("lancamentos");
```

**Nav items para mobile:**
```ts
const mobileNav = [
  { id: "lancamentos", label: "Lançamentos", icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2" },
  { id: "configuracoes", label: "Configurações", icon: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" },
];
```

**Remover (linhas a deletar):**
- Header sticky customizado: linhas 599–657 (~58 linhas deletadas)
- Bottom tab bar customizado: linhas 983–1003 (~20 linhas deletadas)
- Outer `<div style={{ minHeight: "100dvh"... }}>` wrapper root

**Adicionar wrapper MDI:**
```tsx
return (
  <AppShell
    activityBar={
      <ActivityBar
        items={mobileNav}
        activeId={activeTab}
        onOpen={(id) => openTab(id as MobileTab)}
        brandImageSrc="/logo.png"
        brandImageAlt="Controle de Terceiros"
        onBack={irParaDesktop}
        backLabel="Desktop"
        onLogout={() => supabase.auth.signOut()}
      />
    }
    tabBar={
      <TabBar
        tabs={openTabs.map(id => mobileNav.find(n => n.id === id)!)}
        activeId={activeTab}
        onActivate={(id) => setActiveTab(id as MobileTab)}
        onClose={(id) => closeTab(id as MobileTab)}
      />
    }
    statusBar={<StatusBar loading={loading} saved={false} hojeCount={0} mesCount={0} lang="pt-BR" />}
  >
    {/* conteúdo atual inalterado */}
  </AppShell>
);
```

**Todo conteúdo interno (filtros, cards, modais, FAB): inalterado.**
A função `irParaDesktop` permanece; agora é usada via `onBack`.

---

## Arquivos a DELETAR

- `src/components/layout/AppSidebar.tsx`
  - Verificar antes: `grep -r "AppSidebar" src/` → deve retornar só AdminPage.tsx (já migrado)

---

## Arquivos NÃO tocados

- `AppShell.tsx`, `TabBar.tsx`, `StatusBar.tsx`, `useTabManager.ts` — já implementados
- `Index.tsx` — já migrado
- `App.tsx`, `main.tsx`, `globals.css`, `vercel.json`
- Todos os componentes de feature: conteúdo interno de tabs em AdminPage e MobileLancamentosPage
- `src/components/ui/*`, `src/lib/*`, `src/hooks/useStorage.ts`, `src/types/*`

---

## Verificação

1. `grep -r "AppSidebar" src/` → zero resultados (após deletar o arquivo)
2. `pnpm tsc --noEmit` → zero erros de tipo
3. `pnpm build` → build limpo
4. Visual:
   - `/admin`: ActivityBar com ícones usuarios/permissoes/conta + botão Voltar + Sair; TabBar no topo; StatusBar no rodapé
   - `/mobile`: ActivityBar com ícones lancamentos/configuracoes + botão Desktop + Sair; TabBar no topo; StatusBar no rodapé

---

## Estimativa de impacto

| Ação     | Arquivos                                  |
|----------|-------------------------------------------|
| Modificar | 3 (`ActivityBar.tsx`, `AdminPage.tsx`, `MobileLancamentosPage.tsx`) |
| Deletar  | 1 (`AppSidebar.tsx`)                      |
| **Total** | **4**                                    |

**Riscos:**
- `AdminPage.tsx` 1056 linhas → apenas wrapper e imports tocados; conteúdo de tabs intacto
- `MobileLancamentosPage.tsx` 1008 linhas → ActivityBar 48px consome largura em telas estreitas; aceitável, é o padrão do plano
- `closeTab` precisa ser desestruturado de `useTabManager` em ambas as páginas (já existe no hook)
- `StatusBar` em AdminPage e Mobile não recebe counts reais (hojeCount=0) — suficiente para primeira iteração
