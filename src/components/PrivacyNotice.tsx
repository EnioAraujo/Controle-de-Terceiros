import { useState } from "react";
import DOMPurify from "dompurify";
import { useI18n } from "@/hooks/use-i18n";
import { RETENCAO_ANOS } from "@/lib/format-utils";

export const usePrivacyAccepted = () => {
  const [accepted, setAccepted] = useState(() => localStorage.getItem("lgpd_aceito") === "1");
  const accept = () => { localStorage.setItem("lgpd_aceito", "1"); setAccepted(true); };
  return [accepted, accept] as const;
};

export const PrivacyNotice = ({ dpoNome, dpoEmail, onAccept }: { dpoNome: string; dpoEmail: string; onAccept: () => void }) => {
  const { t } = useI18n();
  return (
  <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(11,22,40,.92)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
    <div style={{ background:"#fff", borderRadius:16, maxWidth:620, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,.4)" }}>
      <div style={{ background:"linear-gradient(135deg,#0B1628,#1A2C4A)", padding:"24px 28px", borderRadius:"16px 16px 0 0", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:40, height:40, background:"#1A56DB", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <div style={{ color:"#F8FAFC", fontWeight:800, fontSize:16 }}>{t("privacy_title")}</div>
          <div style={{ color:"#64748B", fontSize:12, marginTop:2 }}>{t("privacy_law")}</div>
        </div>
      </div>

      <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", gap:18, fontSize:13, color:"#334155", lineHeight:1.7 }}>
        <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#1A56DB", fontWeight:600 }}>
          {t("privacy_intro")}
        </div>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_col_title")}</div>
          <ul style={{ paddingLeft:18, margin:0, display:"flex", flexDirection:"column", gap:3, fontSize:12 }}>
            <li>{t("privacy_col_1")}</li>
            <li>{t("privacy_col_2")}</li>
            <li>{t("privacy_col_3")}</li>
            <li>{t("privacy_col_4")}</li>
            <li>{t("privacy_col_5")}</li>
          </ul>
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_legal_title")}</div>
          <p style={{ margin:0, fontSize:12 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t("privacy_legal_text")) }} />
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_ret_title")}</div>
          <p style={{ margin:0, fontSize:12 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t("privacy_ret_text").replace("{years}", String(RETENCAO_ANOS))) }} />
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_sec_title")}</div>
          <p style={{ margin:0, fontSize:12 }}>{t("privacy_sec_text")}</p>
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_rights_title")}</div>
          <p style={{ margin:0, fontSize:12 }}>{t("privacy_rights_text")}</p>
        </section>

        {(dpoNome || dpoEmail) && (
          <section style={{ background:"#F8FAFC", border:"1px solid #E2E6EC", borderRadius:10, padding:"12px 16px" }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_dpo_title")}</div>
            {dpoNome  && <div style={{ fontSize:12 }}><strong>{t("privacy_dpo_name")}</strong> {dpoNome}</div>}
            {dpoEmail && <div style={{ fontSize:12 }}><strong>{t("privacy_dpo_email_lbl")}</strong> {dpoEmail}</div>}
          </section>
        )}

        <button onClick={onAccept} style={{ background:"#1A56DB", border:"none", borderRadius:10, padding:"14px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:14, fontFamily:"inherit", marginTop:4 }}>
          {t("privacy_accept_btn")}
        </button>
        <div style={{ fontSize:11, color:"#94A3B8", textAlign:"center", marginTop:-8 }}>
          {t("privacy_footer")}
        </div>
      </div>
    </div>
  </div>
  );
};
