import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityBar, type ActivityItem } from "@/components/layout/ActivityBar";
import { TabBar } from "@/components/layout/TabBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { useTabManager } from "@/hooks/useTabManager";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { AdminFornecedoresTab } from "@/components/admin/AdminFornecedoresTab";
import { AdminTerceirosTab } from "@/components/admin/AdminTerceirosTab";
import { AdminUsuariosTab } from "@/components/admin/AdminUsuariosTab";
import { AdminPermissoesTab } from "@/components/admin/AdminPermissoesTab";
import { AdminContaTab } from "@/components/admin/AdminContaTab";

type AdminTab = "usuarios" | "permissoes" | "fornecedores" | "terceiros" | "conta";

export default function AdminPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [isAdmin, setIsAdmin] = useState(false);
  const [myEmail, setMyEmail] = useState("");
  const [myId, setMyId] = useState("");
  const [authReady, setAuthReady] = useState(false);

  const { openTabs, activeTab, openTab, closeTab, setActiveTab } = useTabManager<AdminTab>("usuarios");
  const admin = useAdminUsers({ enabled: authReady && isAdmin });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuthReady(true); return; }
      setMyId(session.user.id);
      setMyEmail(session.user.email ?? "");
      const { data: adminResult, error: adminErr } = await supabase.rpc("is_admin");
      if (adminErr && import.meta.env.DEV) console.error("Erro ao verificar admin:", adminErr.message);
      setIsAdmin(!!adminResult);
      setAuthReady(true);
    }).catch((err: unknown) => {
      if (import.meta.env.DEV) console.error("Erro ao obter sessão:", err);
      setAuthReady(true);
    });
  }, []);

  if (!authReady) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#FAF9FB" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color:"#F37E38" }} />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const totalAdmins = admin.users.filter(u => u.role === "admin").length;
  const adminNav: ActivityItem[] = [
    { id: "usuarios",     label: t("admin_tab_users"),  icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
    { id: "permissoes",   label: "Permissões",          icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
    { id: "fornecedores", label: "Fornecedores",        icon: "M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1zM9 5h6v2H9V5z" },
    { id: "terceiros",    label: "Terceiros",           icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
    { id: "conta",        label: t("admin_tab_account"),icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  ];
  const navById = Object.fromEntries(adminNav.map(n => [n.id, n])) as Record<AdminTab, ActivityItem>;
  const tabBarItems = openTabs.map(id => navById[id]);

  return (
    <div style={{ minHeight:"100vh", background:"#FAF9FB", fontFamily:"var(--font-body)" }}>
      <AppShell
        activityBar={(
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
        )}
        tabBar={(
          <TabBar
            tabs={tabBarItems}
            activeId={activeTab}
            onActivate={(id) => setActiveTab(id as AdminTab)}
            onClose={(id) => closeTab(id as AdminTab)}
          />
        )}
        statusBar={(
          <StatusBar
            loading={admin.isLoading}
            saved={false}
            hojeCount={admin.users.length}
            mesCount={totalAdmins}
            hojeLabel={t("admin_stat_total")}
            mesLabel={t("admin_stat_admins")}
            loadingLabel={t("nav_loading")}
            savedLabel={t("nav_saved")}
            connectedLabel={myEmail || "Conectado"}
            lang={lang}
          />
        )}
        mobileTopBar={(
          <div className="rsp-admin-header" style={{ background:"#212B36", borderBottom:"1px solid #2E3B4A", padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ color:"#F8FAFC", fontWeight:700, fontSize:13 }}>{t("admin_panel_title")}</span>
            <div className="rsp-admin-header-right" style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={() => navigate("/")} style={{ background:"transparent", border:"1px solid #2E3B4A", borderRadius:8, padding:"4px 8px", color:"#98A2B3", fontSize:11, fontWeight:600 }}>
                {t("admin_back_app")}
              </button>
              <button onClick={() => supabase.auth.signOut()} style={{ background:"transparent", border:"1px solid #2E3B4A", borderRadius:8, padding:"4px 8px", color:"#EF4444", fontSize:11, fontWeight:600 }}>
                {t("nav_logout")}
              </button>
            </div>
          </div>
        )}
      >
        <div className="rsp-main-admin" style={{ width:"100%", padding:"24px" }}>
          <div className="mb-6">
            <p style={{ fontSize:11, color:"#9898B0", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600, marginBottom:4 }}>{t("admin_section_sys")}</p>
            <h1 style={{ fontSize:24, fontWeight:800, color:"#212B36", letterSpacing:-.5, lineHeight:1.2 }}>{t("admin_panel_title")}</h1>
            <p style={{ fontSize:13, color:"#9898B0", marginTop:4 }}>{t("admin_panel_desc")}</p>
          </div>

          <div className="space-y-6">
            {activeTab === "usuarios"     && <AdminUsuariosTab myId={myId} admin={admin} />}
            {activeTab === "permissoes"   && <AdminPermissoesTab admin={admin} />}
            {activeTab === "fornecedores" && <AdminFornecedoresTab />}
            {activeTab === "terceiros"    && <AdminTerceirosTab />}
            {activeTab === "conta"        && <AdminContaTab myEmail={myEmail} />}
          </div>
        </div>
      </AppShell>
    </div>
  );
}
