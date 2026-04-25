import { useState, useEffect } from "react";
import type { Registro } from "@/types/attendance";
import { sanitize, logAudit } from "@/lib/audit";
import { fmt } from "@/lib/format-utils";
import { useI18n } from "@/hooks/use-i18n";
import { supabase, authReady } from "@/lib/supabase";

interface Props {
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
  isAdmin: boolean;
}

export function ConfigLgpdSection({ registros, setRegistros, isAdmin }: Props) {
  const { t, lang } = useI18n();
  const [dpoNome, setDpoNome] = useState("");
  const [dpoEmail, setDpoEmail] = useState("");
  const [dpoTelefone, setDpoTelefone] = useState("");
  const [dpoSaved, setDpoSaved] = useState(false);
  const [titularNome, setTitularNome] = useState("");
  const [titularResult, setTitularResult] = useState<Registro[] | null>(null);
  const [exclusaoConfirm, setExclusaoConfirm] = useState(false);
  const [exclusaoFeedback, setExclusaoFeedback] = useState("");

  useEffect(() => {
    authReady.then(async () => {
      const { data, error } = await supabase.from("opcoes").select("chave, valor").in("chave", ["dpo_nome", "dpo_email", "dpo_telefone"]);
      if (error) { if (import.meta.env.DEV) console.error("Erro ao carregar DPO:", error.message); return; }
      if (data) {
        data.forEach((row: { chave: string; valor: string }) => {
          if (row.chave === "dpo_nome")     setDpoNome(row.valor);
          if (row.chave === "dpo_email")    setDpoEmail(row.valor);
          if (row.chave === "dpo_telefone") setDpoTelefone(row.valor);
        });
      }
    }).catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao carregar DPO:", err); });
  }, []);

  const saveDpo = async () => {
    const fields = [
      { chave: "dpo_nome",     valor: sanitize(dpoNome.trim()) },
      { chave: "dpo_email",    valor: sanitize(dpoEmail.trim()) },
      { chave: "dpo_telefone", valor: sanitize(dpoTelefone.trim()) },
    ];
    for (const f of fields) {
      await supabase.from("opcoes").delete().eq("chave", f.chave);
      if (f.valor) await supabase.from("opcoes").insert({ chave: f.chave, valor: f.valor });
    }
    setDpoSaved(true);
    setTimeout(() => setDpoSaved(false), 2500);
  };

  const buscarTitular = () => {
    const q = sanitize(titularNome.trim().toUpperCase());
    if (!q) return;
    setTitularResult(registros.filter(r => r.nome === q));
    setExclusaoConfirm(false);
    setExclusaoFeedback("");
  };

  const excluirTitular = () => {
    const q = sanitize(titularNome.trim().toUpperCase());
    const ids = (titularResult ?? []).map(r => r.id);
    if (!ids.length) return;
    setRegistros(registros.filter(r => r.nome !== q));
    logAudit("EXCLUSAO_TITULAR", "registros", undefined, {
      nome: q, registros_removidos: ids.length, ids, motivo: "Solicitação de exclusão Art. 18 LGPD",
    });
    setTitularResult(null);
    setTitularNome("");
    setExclusaoConfirm(false);
    setExclusaoFeedback(t("lgpd_success").replace("{n}", String(ids.length)).replace(/\{s\}/g, ids.length > 1 ? "s" : "").replace("{name}", q));
    setTimeout(() => setExclusaoFeedback(""), 5000);
  };

  if (!isAdmin) return null;

  return (
    <>
      {/* DPO (Art. 41 LGPD) */}
      <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6C63FF", flexShrink: 0 }} />
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>{t("dpo_title")}</div>
          <div style={{ fontSize: 11, background: "#6C63FF18", color: "#6C63FF", fontWeight: 700, borderRadius: 99, padding: "2px 8px" }}>{t("dpo_badge")}</div>
        </div>
        <div className="rsp-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("dpo_label_nome")}</label>
            <input value={dpoNome} onChange={e => setDpoNome(sanitize(e.target.value))} placeholder={t("dpo_ph_nome")}
              style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", background: "#FAFBFC", outline: "none" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("dpo_label_email")}</label>
            <input type="email" value={dpoEmail} onChange={e => setDpoEmail(sanitize(e.target.value))} placeholder={t("dpo_ph_email")}
              style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", background: "#FAFBFC", outline: "none" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("dpo_label_tel")}</label>
            <input value={dpoTelefone} onChange={e => setDpoTelefone(sanitize(e.target.value))} placeholder={t("dpo_ph_tel")}
              style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", background: "#FAFBFC", outline: "none" }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={saveDpo} style={{ background: "#6C63FF", border: "none", borderRadius: 8, padding: "9px 22px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
            {t("dpo_btn_save")}
          </button>
          {dpoSaved && <span style={{ fontSize: 12, color: "#0E9F6E", fontWeight: 600 }}>{t("dpo_saved")}</span>}
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 10 }}>{t("dpo_desc")}</div>
      </div>

      {/* Exclusão por Solicitação (Art. 18 LGPD) */}
      <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#E02424", flexShrink: 0 }} />
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>{t("lgpd_title")}</div>
          <div style={{ fontSize: 11, background: "#E0242418", color: "#E02424", fontWeight: 700, borderRadius: 99, padding: "2px 8px" }}>{t("lgpd_badge")}</div>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>{t("lgpd_desc")}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={titularNome} onChange={e => setTitularNome(e.target.value)}
            onKeyDown={e => e.key === "Enter" && buscarTitular()}
            placeholder={t("lgpd_placeholder")}
            style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none", flex: 1, textTransform: "uppercase" }} />
          <button onClick={buscarTitular} style={{ background: "#334155", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit", flexShrink: 0 }}>
            {t("lgpd_search_btn")}
          </button>
        </div>
        {titularResult !== null && (
          <div style={{ border: "1px solid #E2E6EC", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ background: "#F8FAFC", padding: "10px 16px", fontSize: 12, color: "#64748B", borderBottom: "1px solid #E2E6EC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{t("lgpd_result_for")} <strong style={{ color: "#0F1C2E" }}>{titularNome.trim().toUpperCase()}</strong></span>
              <span style={{ fontWeight: 700, color: titularResult.length > 0 ? "#E02424" : "#0E9F6E" }}>
                {t("lgpd_found").replace("{n}", String(titularResult.length)).replace(/\{s\}/g, titularResult.length !== 1 ? "s" : "")}
              </span>
            </div>
            {titularResult.length === 0 ? (
              <div style={{ padding: "20px 16px", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>{t("lgpd_not_found")}</div>
            ) : (
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                  {titularResult.slice(0, 5).map(r => (
                    <div key={r.id} style={{ display: "flex", gap: 10, fontSize: 11, color: "#475569", background: "#FFF5F5", borderRadius: 6, padding: "5px 10px" }}>
                      <span style={{ color: "#94A3B8", fontFamily: "monospace" }}>{fmt(r.data, lang)}</span>
                      <span>{r.turno}</span>
                      <span>{r.fornecedor}</span>
                      <span style={{ color: "#64748B" }}>{r.horaEntrada}–{r.horaSaida}</span>
                    </div>
                  ))}
                  {titularResult.length > 5 && <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "center" }}>{t("lgpd_hidden").replace("{n}", String(titularResult.length - 5)).replace(/\{s\}/g, titularResult.length - 5 > 1 ? "s" : "")}</div>}
                </div>
                {!exclusaoConfirm ? (
                  <button onClick={() => setExclusaoConfirm(true)}
                    style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 8, padding: "9px 18px", cursor: "pointer", color: "#E02424", fontWeight: 700, fontSize: 13, fontFamily: "inherit", alignSelf: "flex-start" }}>
                    {t("lgpd_request_btn").replace("{n}", String(titularResult.length)).replace(/\{s\}/g, titularResult.length !== 1 ? "s" : "")}
                  </button>
                ) : (
                  <div style={{ background: "#FFF5F5", border: "1.5px solid #FECACA", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#E02424" }}>{t("lgpd_confirm_title")}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      {t("lgpd_confirm_text").replace("{n}", String(titularResult.length)).replace(/\{s\}/g, titularResult.length !== 1 ? "s" : "").replace("{name}", titularNome.trim().toUpperCase())}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={excluirTitular} style={{ background: "#E02424", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                        {t("lgpd_confirm_btn")}
                      </button>
                      <button onClick={() => setExclusaoConfirm(false)} style={{ background: "#F1F5F9", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", color: "#475569", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                        {t("lgpd_cancel_btn")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {exclusaoFeedback && (
          <div style={{ fontSize: 12, color: "#0E9F6E", fontWeight: 600, background: "#E6F9F4", borderRadius: 7, padding: "9px 14px" }}>{exclusaoFeedback}</div>
        )}
      </div>
    </>
  );
}
