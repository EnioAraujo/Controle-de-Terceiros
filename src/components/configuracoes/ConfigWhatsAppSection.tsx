import { useState, useEffect } from "react";
import { sanitize } from "@/lib/audit";
import { buildWhatsAppMessage, WHATSAPP_FIELDS, WA_DEFAULT_TEMPLATE } from "@/lib/format-utils";
import type { WhatsAppTemplate, WhatsAppField } from "@/lib/format-utils";
import { supabase, authReady } from "@/lib/supabase";

interface Props {
  setWaTemplate: (t: WhatsAppTemplate) => void;
  isAdminOrMod: boolean;
}

export function ConfigWhatsAppSection({ setWaTemplate, isAdminOrMod }: Props) {
  const [waHeader, setWaHeader] = useState(WA_DEFAULT_TEMPLATE.header);
  const [waCampos, setWaCampos] = useState<WhatsAppField[]>(WA_DEFAULT_TEMPLATE.campos);
  const [waSaved, setWaSaved] = useState(false);
  const [waSaveError, setWaSaveError] = useState("");
  const [waDragOver, setWaDragOver] = useState<WhatsAppField | null>(null);

  useEffect(() => {
    authReady.then(async () => {
      const { data } = await supabase.from("opcoes").select("valor").eq("chave", "whatsapp_template").maybeSingle();
      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor) as { header?: string; campos?: WhatsAppField[] };
          if (parsed.header) setWaHeader(parsed.header);
          if (Array.isArray(parsed.campos) && parsed.campos.length > 0) setWaCampos(parsed.campos);
        } catch { /* ignore bad JSON */ }
      }
    }).catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao carregar WA template:", err); });
  }, []);

  const saveWaTemplate = async () => {
    const payload: WhatsAppTemplate = { header: waHeader.trim() || WA_DEFAULT_TEMPLATE.header, campos: waCampos };
    const valor = JSON.stringify(payload);
    setWaSaveError("");
    const { error: delErr } = await supabase.from("opcoes").delete().eq("chave", "whatsapp_template");
    if (delErr) { setWaSaveError("Erro ao salvar. Tente novamente."); return; }
    const { error: insErr } = await supabase.from("opcoes").insert({ chave: "whatsapp_template", valor });
    if (insErr) { setWaSaveError("Erro ao salvar. Tente novamente."); return; }
    setWaTemplate(payload);
    setWaSaved(true);
    setTimeout(() => setWaSaved(false), 2500);
  };

  const toggleWaCampo = (key: WhatsAppField) => {
    setWaCampos(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  if (!isAdminOrMod) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#25D366", flexShrink: 0 }} />
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>Template WhatsApp</div>
        <div style={{ fontSize: 11, background: "#25D36618", color: "#25D366", fontWeight: 700, borderRadius: 99, padding: "2px 8px" }}>Mensagem</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>Título da mensagem</label>
        <input value={waHeader} onChange={e => setWaHeader(sanitize(e.target.value))}
          placeholder="REGISTRO DE PRESENÇA"
          style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", background: "#FAFBFC", outline: "none", maxWidth: 340 }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>Campos incluídos na mensagem</label>
          {waCampos.length > 1 && <span style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>⠿ arraste para reordenar</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            ...waCampos.map(k => WHATSAPP_FIELDS.find(f => f.key === k)!).filter(Boolean),
            ...WHATSAPP_FIELDS.filter(f => !waCampos.includes(f.key)),
          ].map(f => {
            const included = waCampos.includes(f.key);
            return (
              <div key={f.key}
                onDragOver={included ? (e) => { e.preventDefault(); setWaDragOver(f.key); } : undefined}
                onDragLeave={included ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setWaDragOver(null); } : undefined}
                onDrop={included ? (e) => {
                  e.preventDefault();
                  const src = e.dataTransfer.getData("text/plain") as WhatsAppField;
                  if (src !== f.key && waCampos.includes(src)) {
                    setWaCampos(prev => {
                      const arr = [...prev];
                      const fi = arr.indexOf(src);
                      arr.splice(fi, 1);
                      arr.splice(arr.indexOf(f.key), 0, src);
                      return arr;
                    });
                  }
                  setWaDragOver(null);
                } : undefined}
                style={{
                  display: "flex", alignItems: "center", borderRadius: 6,
                  background: waDragOver === f.key ? "#BBF7D0" : included ? "#25D36614" : "#F8FAFC",
                  border: waDragOver === f.key ? "1.5px dashed #16A34A" : included ? "1px solid #25D366" : "1px solid #E2E6EC",
                  transition: "all .15s",
                }}>
                {included && (
                  <span draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", f.key); }} onDragEnd={() => setWaDragOver(null)}
                    style={{ padding: "0 2px 0 8px", cursor: "grab", color: "#94A3B8", fontSize: 13, userSelect: "none", lineHeight: "1.9" }}>⠿</span>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", padding: included ? "4px 10px 4px 4px" : "4px 10px" }}>
                  <input type="checkbox" checked={included} onChange={() => toggleWaCampo(f.key)} style={{ accentColor: "#25D366" }} />
                  <span style={{ fontWeight: included ? 600 : 400, color: included ? "#166534" : "#64748B" }}>{f.label}</span>
                </label>
              </div>
            );
          })}
        </div>
      </div>
      {waCampos.length > 0 && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap", color: "#166534", lineHeight: 1.6 }}>
          {buildWhatsAppMessage([{
            id: "preview", data: "2026-03-15", turno: "Dia", horaEntrada: "08:00", horaSaida: "17:00",
            totalHoras: "09:00", nome: "João Silva", cargo: "Operador", setor: "",
            unidade: "SP-001", cc: "1234", motivo: "Demanda operacional",
            fornecedor: "ABC Serviços", obs: "Exemplo de observação",
          }], { header: waHeader || WA_DEFAULT_TEMPLATE.header, campos: waCampos })}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={saveWaTemplate} disabled={waCampos.length === 0}
          style={{ background: waCampos.length > 0 ? "#25D366" : "#94A3B8", border: "none", borderRadius: 8, padding: "9px 22px", cursor: waCampos.length > 0 ? "pointer" : "not-allowed", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
          Salvar Template
        </button>
        {waSaved && <span style={{ fontSize: 12, color: "#0E9F6E", fontWeight: 600 }}>✓ Salvo!</span>}
        {waSaveError && <span style={{ fontSize: 12, color: "#E02424", fontWeight: 600 }}>{waSaveError}</span>}
      </div>
      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 10 }}>
        Configure quais campos aparecem na mensagem do WhatsApp ao compartilhar registros.
      </div>
    </div>
  );
}
