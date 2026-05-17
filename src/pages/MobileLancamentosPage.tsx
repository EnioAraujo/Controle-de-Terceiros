import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Registro } from "@/types/attendance";
import { supabase } from "@/lib/supabase";
import { buildWhatsAppMessage } from "@/lib/format-utils";
import { FormLancamento } from "@/components/FormLancamento";
import { useHierarquia } from "@/hooks/useHierarquia";
import { useI18n } from "@/hooks/use-i18n";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityBar, type ActivityItem } from "@/components/layout/ActivityBar";
import { TabBar } from "@/components/layout/TabBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { useTabManager } from "@/hooks/useTabManager";
import { useMobileLancamentos } from "@/hooks/useMobileLancamentos";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { MobileConfirmDialog } from "@/components/mobile/MobileConfirmDialog";
import { MobileFormModal } from "@/components/mobile/MobileFormModal";
import { MobileFab } from "@/components/mobile/MobileFab";
import { MobileFiltros } from "@/components/mobile/MobileFiltros";
import { MobileConfiguracoes } from "@/components/mobile/MobileConfiguracoes";
import { MobileLancamentosList } from "@/components/mobile/MobileLancamentosList";

type MobileTab = "lancamentos" | "configuracoes";

const allIds = (item: Registro | Registro[]) =>
  Array.isArray(item) ? item.map(x => x.id) : [item.id];

export default function MobileLancamentosPage() {
  const navigate = useNavigate();
  const { lang } = useI18n();

  const {
    registros, setRegistros,
    opcoes, turnosConfig, waTemplate,
    loading,
    filtros, setFiltros,
    filtered, grupos,
    addOpcao, removeOpcao,
  } = useMobileLancamentos();

  const hierarquiaApi = useHierarquia();

  const [showFiltros, setShowFiltros] = useState(false);
  const [modal, setModal] = useState<null | "new" | Registro | Registro[]>(null);
  const [sheet, setSheet] = useState<null | Registro | Registro[]>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { openTabs, activeTab, openTab, closeTab, setActiveTab } = useTabManager<MobileTab>("lancamentos");

  const salvar = (novos: Registro[]) => {
    const nomesLote = novos.map(r => r.nome.toLowerCase());
    const semDup = novos.filter((r, idx) => nomesLote.indexOf(r.nome.toLowerCase()) === idx);

    if (modal === "new") {
      setRegistros([...registros, ...semDup]);
    } else if (Array.isArray(modal)) {
      const ids = new Set((modal as Registro[]).map(r => r.id));
      setRegistros([...registros.filter(r => !ids.has(r.id)), ...semDup]);
    } else if (modal) {
      setRegistros(registros.map(r => r.id === semDup[0]?.id ? semDup[0] : r));
    }
    setModal(null);
  };

  const excluir = (ids: string[]) => {
    setRegistros(registros.filter(r => !ids.includes(r.id)));
    setSelectedIds([]);
    setConfirm(null);
    setSheet(null);
  };

  const isChecked = (item: Registro | Registro[]) =>
    allIds(item).every(id => selectedIds.includes(id));

  const toggleCheck = (item: Registro | Registro[], checked: boolean) => {
    const ids = allIds(item);
    setSelectedIds(val =>
      checked ? [...new Set([...val, ...ids])] : val.filter(id => !ids.includes(id)),
    );
  };

  const irParaDesktop = () => {
    sessionStorage.removeItem("deviceMode");
    navigate("/", { replace: true });
  };

  const modalTitle = () => {
    if (modal === "new") return "Novo Lançamento";
    if (Array.isArray(modal)) return `Editar Lote — ${(modal as Registro[]).length} pessoa(s)`;
    return "Editar Lançamento";
  };

  const mobileNav: ActivityItem[] = [
    { id: "lancamentos",  label: "Lançamentos",   icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
    { id: "configuracoes", label: "Configurações", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.94 11a8 8 0 0 0-15.88 0H2v2h2.06a8 8 0 0 0 15.88 0H22v-2h-2.06z" },
  ];
  const navById = Object.fromEntries(mobileNav.map(n => [n.id, n])) as Record<MobileTab, ActivityItem>;
  const tabBarItems = openTabs.map(id => navById[id]);

  return (
    <AppShell
      activityBar={(
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
      )}
      tabBar={(
        <TabBar
          tabs={tabBarItems}
          activeId={activeTab}
          onActivate={(id) => setActiveTab(id as MobileTab)}
          onClose={(id) => closeTab(id as MobileTab)}
        />
      )}
      statusBar={(
        <StatusBar
          loading={loading}
          saved={false}
          hojeCount={filtered.length}
          mesCount={registros.length}
          hojeLabel="Filtrados"
          mesLabel="Total"
          loadingLabel="Carregando"
          savedLabel="Salvo"
          connectedLabel="Conectado"
          lang={lang}
        />
      )}
    >
      <div style={{ padding: "16px 12px 144px" }}>
        {activeTab === "lancamentos" && <>
          <MobileFiltros
            filtros={filtros}
            setFiltros={setFiltros}
            showFiltros={showFiltros}
            toggleShow={() => setShowFiltros(f => !f)}
            turnosOpts={opcoes.turnos}
            fornecedoresOpts={opcoes.fornecedores}
          />

          <MobileLancamentosList
            loading={loading}
            filtered={filtered}
            totalCount={registros.length}
            grupos={grupos}
            selectedIds={selectedIds}
            onBulkDelete={() => setConfirm(selectedIds)}
            onSelectItem={item => setSheet(item)}
            isChecked={isChecked}
            toggleCheck={toggleCheck}
            fornecedores={opcoes.fornecedores}
            lang={lang}
          />
        </>}

        {activeTab === "configuracoes" && (
          <MobileConfiguracoes opcoes={opcoes} addOpcao={addOpcao} removeOpcao={removeOpcao} />
        )}
      </div>

      {activeTab === "lancamentos" && <MobileFab onClick={() => setModal("new")} />}

      <MobileBottomSheet
        item={sheet}
        onClose={() => setSheet(null)}
        onEdit={() => { setModal(sheet); setSheet(null); }}
        onDelete={() => { setConfirm(allIds(sheet!)); setSheet(null); }}
        onWhatsApp={() => {
          if (!sheet) return;
          const regs = Array.isArray(sheet) ? sheet : [sheet];
          const msg = buildWhatsAppMessage(regs, waTemplate);
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
          setSheet(null);
        }}
      />

      {confirm && (
        <MobileConfirmDialog
          count={confirm.length}
          onConfirm={() => excluir(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {modal && (
        <MobileFormModal title={modalTitle()} onClose={() => setModal(null)}>
          <FormLancamento
            inicial={modal === "new" || Array.isArray(modal) ? null : modal as Registro}
            loteInicial={Array.isArray(modal) ? (modal as Registro[]) : undefined}
            onSave={salvar}
            onCancel={() => setModal(null)}
            opcoes={opcoes}
            hierarquia={hierarquiaApi.hierarquia}
            registros={registros}
            turnosConfig={turnosConfig}
          />
        </MobileFormModal>
      )}
    </AppShell>
  );
}
