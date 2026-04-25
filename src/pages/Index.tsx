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
import { usePrivacyAccepted, PrivacyNotice } from "@/components/PrivacyNotice";
import { Dashboard } from "@/components/Dashboard";
import { FechamentoTab } from "@/components/FechamentoTab";
import { Icon } from "@/components/atoms";
import { AppShell } from "@/components/layout/AppShell";
import { AppSidebar } from "@/components/layout/AppSidebar";

// ═══════════════════════════════════════════════════════════════
// INDEX
// ═══════════════════════════════════════════════════════════════
type TabId = "dashboard" | "lancamentos" | "projecao" | "fechamento" | "configuracoes";
interface NavItem { id: TabId; label: string; icon: string; }

const Index = () => {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [tab, setTab]                          = useState<TabId>("dashboard");
  const [registros, setRegistros, loadingRegs] = useStorage();
  const [opcoes, setOpcoes, loadingOpts]        = useOpcoes();
  const [saved, setSaved]                      = useState(false);
  const loading                                = loadingRegs || loadingOpts;
  const [privacyAccepted, acceptPrivacy]       = usePrivacyAccepted();
  const [dpoCfg, setDpoCfg]                   = useState<{ nome: string; email: string }>({ nome: "", email: "" });
  const [isAdmin, setIsAdmin]                  = useState(false);
  // isAdminOrMod=true: seções de opções visíveis a todos os autenticados;
  // isAdmin guarda apenas DPO, LGPD/titular e "Excluir Todos" (AI_RULES.md)
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

  return (
    <>
      {!privacyAccepted && (
        <PrivacyNotice dpoNome={dpoCfg.nome} dpoEmail={dpoCfg.email} onAccept={acceptPrivacy} />
      )}
      <div style={{ minHeight:"100vh", background:"#FAF9FB", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        `}</style>
        <AppShell
          sidebar={(
            <AppSidebar
              items={NAV}
              activeItemId={tab}
              onItemClick={(id) => setTab(id as TabId)}
              brandImageSrc={tab === "dashboard" ? "/dashboard.png" : "/logo.png"}
              brandImageAlt="Controle de Terceiros"
              footer={(
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", gap:12, fontSize:11 }}>
                    <div style={{ color:"#9898B0" }}>{t("nav_hoje")} <strong style={{ color:"#F8FAFC" }}>{hoje_}</strong></div>
                    <div style={{ color:"#9898B0" }}>{t("nav_mes")} <strong style={{ color:"#F8FAFC" }}>{mes_}</strong></div>
                  </div>
                  {loading && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, background:"#F37E3818", border:"1px solid #F37E3833", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#F37E38", fontWeight:600 }}>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      {t("nav_loading")}
                    </div>
                  )}
                  {saved && !loading && (
                    <div style={{ display:"flex", alignItems:"center", gap:5, background:"#0E9F6E22", border:"1px solid #0E9F6E44", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#0E9F6E", fontWeight:600 }}>
                      <Icon d="M5 13l4 4L19 7" size={12} /> {t("nav_saved")}
                    </div>
                  )}
                  <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#9898B0", fontFamily:"'DM Mono',monospace" }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:"#0E9F6E", boxShadow:"0 0 0 3px #0E9F6E30" }} />
                    {new Date().toLocaleTimeString(lang, { hour:"2-digit", minute:"2-digit" })}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => navigate("/admin")}
                      title="Painel de administração"
                      style={{ display:"flex", alignItems:"center", gap:5, background:"#F37E3818", border:"1px solid #F37E3844", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#F37E38", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
                    >
                      <img src="/admin.png" width={14} height={14} alt="" style={{ borderRadius:3 }} />
                      {t("nav_admin")}
                    </button>
                  )}
                  <button
                    onClick={() => { sessionStorage.setItem("deviceMode", "mobile"); navigate("/mobile"); }}
                    title="Mudar para versão mobile"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"transparent", border:"1px solid #2E3B4A", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#9898B0", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    Mobile
                  </button>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    title="Sair do sistema"
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, background:"transparent", border:"1px solid #2E3B4A", borderRadius:8, padding:"6px 10px", cursor:"pointer", color:"#EF4444", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                    {t("nav_logout")}
                  </button>
                </div>
              )}
            />
          )}
          mobileTopBar={(
            <div className="rsp-header" style={{ background:"#212B36", borderBottom:"1px solid #2E3B4A", padding:"10px 12px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <img src={tab === "dashboard" ? "/dashboard.png" : "/logo.png"} width={28} height={28} alt="" style={{ borderRadius:8 }} />
                  <span style={{ color:"#F8FAFC", fontWeight:700, fontSize:13 }}>Controle de Terceiros</span>
                </div>
                <button onClick={() => supabase.auth.signOut()} style={{ background:"transparent", border:"1px solid #2E3B4A", borderRadius:8, padding:"4px 8px", color:"#EF4444", fontSize:11, fontWeight:600 }}>
                  {t("nav_logout")}
                </button>
              </div>
              <div style={{ display:"flex", overflowX:"auto", gap:6 }}>
                {NAV.map(n => (
                  <button key={n.id} onClick={() => setTab(n.id)} style={{
                    display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", padding:"6px 10px", borderRadius:8, border:"none", cursor:"pointer",
                    background: tab === n.id ? "#F37E38" : "rgba(255,255,255,0.08)", color: tab === n.id ? "#fff" : "#CBD5E1", fontSize:12, fontWeight:600,
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
              {tab === "dashboard"     && <Dashboard    registros={registros} opcoes={opcoes} isAdminOrMod={isAdminOrMod} />}
              {tab === "lancamentos"   && <Lancamentos  registros={registros} setRegistros={wrap(setRegistros)} opcoes={opcoes} turnosConfig={turnosConfig} capacidadeConfig={capacidadeConfig} isAdmin={isAdmin} waTemplate={waTemplate} />}
              {tab === "projecao"      && <ProjecaoPage  registros={registros} opcoes={opcoes} />}
              {tab === "fechamento"    && <FechamentoTab registros={registros} opcoes={opcoes} capacidadeConfig={capacidadeConfig} />}
              {tab === "configuracoes" && <Configuracoes opcoes={opcoes} setOpcoes={setOpcoes} registros={registros} setRegistros={setRegistros} isAdmin={isAdmin} isAdminOrMod={isAdminOrMod} setWaTemplate={setWaTemplate} capacidadeConfig={capacidadeConfig} setCapacidadeConfig={setCapacidadeConfig} />}
            </>
          )}
          </div>
        </AppShell>
      </div>
    </>
  );
};

export default Index;
