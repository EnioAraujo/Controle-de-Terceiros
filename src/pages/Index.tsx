import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { type Registro } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { hoje, mesAtual, WA_DEFAULT_TEMPLATE } from "@/lib/format-utils";
import type { WhatsAppTemplate } from "@/lib/format-utils";
import { type TurnoConfig, dbToTurnoConfig, type TurnoCapacidade, dbToTurnoCapacidade } from "@/lib/fechamento-utils";
import ProjecaoPage from "@/pages/ProjecaoPage";
import { Configuracoes } from "@/components/Configuracoes";
import { Lancamentos } from "@/components/Lancamentos";
import { useStorage } from "@/hooks/useStorage";
import { useOpcoes } from "@/hooks/useOpcoes";
import { useHierarquia } from "@/hooks/useHierarquia";
import { useTabManager } from "@/hooks/useTabManager";
import { usePrivacyAccepted, PrivacyNotice } from "@/components/PrivacyNotice";
import { Dashboard } from "@/components/Dashboard";
import { FechamentoTab } from "@/components/FechamentoTab";
import { Icon } from "@/components/atoms";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { TabBar } from "@/components/layout/TabBar";
import { StatusBar } from "@/components/layout/StatusBar";

type TabId = "dashboard" | "lancamentos" | "projecao" | "fechamento" | "configuracoes";
interface NavItem { id: TabId; label: string; icon: string; }

const Index = () => {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { openTabs, activeTab, openTab, closeTab, setActiveTab } = useTabManager<TabId>("dashboard");
  const [registros, setRegistros, loadingRegs] = useStorage();
  const [opcoes, setOpcoes, loadingOpts]        = useOpcoes();
  const hierarquiaApi                          = useHierarquia();
  const [saved, setSaved]                      = useState(false);
  const loading                                = loadingRegs || loadingOpts || hierarquiaApi.loading;
  const [privacyAccepted, acceptPrivacy]       = usePrivacyAccepted();
  const [dpoCfg, setDpoCfg]                   = useState<{ nome: string; email: string }>({ nome: "", email: "" });
  const [isAdmin, setIsAdmin]                  = useState(false);
  const isAdminOrMod                           = true;
  const [waTemplate, setWaTemplate]            = useState<WhatsAppTemplate>(WA_DEFAULT_TEMPLATE);
  const [turnosConfig, setTurnosConfig]        = useState<TurnoConfig[]>([]);
  const [capacidadeConfig, setCapacidadeConfig] = useState<TurnoCapacidade[]>([]);

  useEffect(() => {
    authReady.then(async () => {
      const { data: tcData } = await supabase.from("turnos_config").select("*").order("turno");
      if (tcData) setTurnosConfig(tcData.map(dbToTurnoConfig));
      const { data: capData } = await supabase.from("turnos_capacidade").select("*").order("turno");
      if (capData) setCapacidadeConfig(capData.map(dbToTurnoCapacidade));
    });
  }, []);

  useEffect(() => {
    authReady.then(() => {
      supabase.from("opcoes").select("chave,valor")
        .in("chave", ["dpo_nome", "dpo_email", "whatsapp_template"])
        .then(({ data }) => {
          if (!data) return;
          const m: Record<string, string> = {};
          data.forEach((r: { chave: string; valor: string }) => { m[r.chave] = r.valor; });
          setDpoCfg({ nome: m["dpo_nome"] ?? "", email: m["dpo_email"] ?? "" });
          if (m["whatsapp_template"]) {
            try {
              const p = JSON.parse(m["whatsapp_template"]);
              if (p.header && Array.isArray(p.campos) && p.campos.length > 0) setWaTemplate(p);
            } catch { /* ignore bad JSON */ }
          }
        });
      supabase.rpc('is_admin')
        .then(({ data }) => { if (data) setIsAdmin(true); });
    });
  }, []);

  const wrap = (fn: (val: Registro[]) => void) => (val: Registro[]) => {
    fn(val); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const hoje_ = registros.filter(r => r.data === hoje()).length;
  const mes_  = registros.filter(r => r.data.startsWith(mesAtual())).length;

  const NAV: NavItem[] = [
    { id: "dashboard",     label: t("nav_tab_dashboard"), icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
    { id: "lancamentos",   label: t("nav_tab_lanc"),      icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
    { id: "projecao",      label: t("nav_tab_proj"),      icon: "M2 20h20M5 20V10l3-7 3 7v10M15 20V6l3-4 3 4v14" },
    { id: "fechamento",    label: t("nav_tab_fech"),      icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
    { id: "configuracoes", label: t("nav_tab_cfg"),       icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.94 11a8 8 0 0 0-15.88 0H2v2h2.06a8 8 0 0 0 15.88 0H22v-2h-2.06z" },
  ];

  const navById = Object.fromEntries(NAV.map(n => [n.id, n])) as Record<TabId, NavItem>;
  const tabBarItems = openTabs.map(id => ({ id, label: navById[id].label, icon: navById[id].icon }));

  const brandImageSrc = activeTab === "dashboard" ? "/dashboard.png" : "/logo.png";

  return (
    <>
      {!privacyAccepted && (
        <PrivacyNotice dpoNome={dpoCfg.nome} dpoEmail={dpoCfg.email} onAccept={acceptPrivacy} />
      )}
      <div style={{ background:"#FAF9FB", fontFamily:"var(--font-body)" }}>
        <AppShell
          activityBar={(
            <ActivityBar
              items={NAV}
              activeId={activeTab}
              onOpen={(id) => openTab(id as TabId)}
              brandImageSrc={brandImageSrc}
              brandImageAlt="Controle de Terceiros"
              isAdmin={isAdmin}
              onAdmin={() => navigate("/admin")}
              onMobile={() => { sessionStorage.setItem("deviceMode", "mobile"); navigate("/mobile"); }}
              onLogout={() => supabase.auth.signOut()}
              adminLabel={t("nav_admin")}
              mobileLabel="Mobile"
              logoutLabel={t("nav_logout")}
            />
          )}
          tabBar={(
            <TabBar
              tabs={tabBarItems}
              activeId={activeTab}
              onActivate={(id) => setActiveTab(id as TabId)}
              onClose={(id) => closeTab(id as TabId)}
            />
          )}
          statusBar={(
            <StatusBar
              loading={loading}
              saved={saved}
              hojeCount={hoje_}
              mesCount={mes_}
              hojeLabel={t("nav_hoje")}
              mesLabel={t("nav_mes")}
              loadingLabel={t("nav_loading")}
              savedLabel={t("nav_saved")}
              connectedLabel="Conectado"
              lang={lang}
            />
          )}
          mobileTopBar={(
            <div className="rsp-header" style={{ background:"#212B36", borderBottom:"1px solid #2E3B4A", padding:"10px 12px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <img src={brandImageSrc} width={28} height={28} alt="" style={{ borderRadius:8 }} />
                  <span style={{ color:"#F8FAFC", fontWeight:700, fontSize:13 }}>Controle de Terceiros</span>
                </div>
                <button onClick={() => supabase.auth.signOut()} style={{ background:"transparent", border:"1px solid #2E3B4A", borderRadius:8, padding:"4px 8px", color:"#EF4444", fontSize:11, fontWeight:600 }}>
                  {t("nav_logout")}
                </button>
              </div>
              <div style={{ display:"flex", overflowX:"auto", gap:6 }}>
                {NAV.map(n => (
                  <button key={n.id} onClick={() => openTab(n.id)} style={{
                    display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", padding:"6px 10px", borderRadius:8, border:"none", cursor:"pointer",
                    background: activeTab === n.id ? "#F37E38" : "rgba(255,255,255,0.08)", color: activeTab === n.id ? "#fff" : "#CBD5E1", fontSize:12, fontWeight:600,
                  }}>
                    <Icon d={n.icon} size={14} />
                    <span>{n.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        >
          <div className="rsp-main" style={{ width:"100%" }}>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:16 }}>
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#F37E38" strokeWidth={2} style={{ animation:"spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              <div style={{ fontSize:14, color:"#64748B", fontWeight:600 }}>{t("nav_loading_data")}</div>
              <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
            </div>
          ) : (
            <>
              {activeTab === "dashboard"     && <Dashboard    registros={registros} opcoes={opcoes} turnosConfig={turnosConfig} isAdminOrMod={isAdminOrMod} />}
              {activeTab === "lancamentos"   && <Lancamentos  registros={registros} setRegistros={wrap(setRegistros)} opcoes={opcoes} hierarquia={hierarquiaApi.hierarquia} turnosConfig={turnosConfig} capacidadeConfig={capacidadeConfig} isAdmin={isAdmin} waTemplate={waTemplate} />}
              {activeTab === "projecao"      && <ProjecaoPage  registros={registros} opcoes={opcoes} />}
              {activeTab === "fechamento"    && <FechamentoTab registros={registros} opcoes={opcoes} capacidadeConfig={capacidadeConfig} />}
              {activeTab === "configuracoes" && <Configuracoes opcoes={opcoes} setOpcoes={setOpcoes} registros={registros} setRegistros={setRegistros} isAdmin={isAdmin} isAdminOrMod={isAdminOrMod} setWaTemplate={setWaTemplate} capacidadeConfig={capacidadeConfig} setCapacidadeConfig={setCapacidadeConfig} hierarquiaApi={hierarquiaApi} />}
            </>
          )}
          </div>
        </AppShell>
      </div>
    </>
  );
};

export default Index;
