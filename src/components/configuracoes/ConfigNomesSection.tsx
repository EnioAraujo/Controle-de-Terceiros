import { useState, CSSProperties } from "react";
import type { Opcoes, Registro } from "@/types/attendance";
import { OPCOES_CONFIG } from "@/types/attendance";
import { sanitize, logAudit } from "@/lib/audit";
import { Icon } from "@/components/atoms";
import { useI18n } from "@/hooks/use-i18n";
import { supabase, authReady } from "@/lib/supabase";

type OpcKey = keyof Opcoes;

interface Props {
  opcoes: Opcoes;
  setOpcoes: (val: Opcoes) => void;
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
  isAdminOrMod: boolean;
}

const inStyle: CSSProperties = {
  border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "6px 10px",
  fontSize: 12, fontFamily: "inherit", outline: "none", background: "#FAFBFC", flex: 1,
};

export function ConfigNomesSection({ opcoes, setOpcoes, registros, setRegistros, isAdminOrMod }: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<{ idx: number; value: string } | null>(null);
  const [inputNome, setInputNome] = useState("");
  const [nomesBulk, setNomesBulk] = useState("");
  const [nomeBusca, setNomeBusca] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [bulkCategory, setBulkCategory] = useState<OpcKey>("nomes");

  const addNome = (value: string) => {
    const v = sanitize(value.trim().toUpperCase());
    if (!v || opcoes.nomes.includes(v)) return;
    setOpcoes({ ...opcoes, nomes: [...opcoes.nomes, v] });
    setInputNome("");
  };

  const removeNome = (idx: number) => {
    const arr = [...opcoes.nomes];
    arr.splice(idx, 1);
    setOpcoes({ ...opcoes, nomes: arr });
  };

  const renameNome = (idx: number, newValue: string) => {
    const v = sanitize(newValue.trim().toUpperCase());
    const oldValue = opcoes.nomes[idx];
    setEditing(null);
    if (!v || v === oldValue || opcoes.nomes.includes(v)) return;
    const arr = [...opcoes.nomes];
    arr[idx] = v;
    setOpcoes({ ...opcoes, nomes: arr });
    setRegistros(registros.map(r => r.nome === oldValue ? { ...r, nome: v } : r));
    logAudit("UPDATE", "terceiros", undefined, { valorAnterior: oldValue, valorNovo: v });
  };

  const importItems = async (key: OpcKey) => {
    const novos = [...new Set(
      nomesBulk.split("\n").map(n => sanitize(n.trim().toUpperCase())).filter(n => n.length > 0)
    )].filter(n => !opcoes[key].includes(n));

    if (novos.length === 0) { setBulkFeedback(t("cfg_import_none")); return; }
    setBulkFeedback(t("cfg_import_saving"));

    const CHUNK = 100;
    const table = key === "nomes" ? "terceiros" : "opcoes";
    for (let i = 0; i < novos.length; i += CHUNK) {
      const batch = novos.slice(i, i + CHUNK);
      const payload = key === "nomes"
        ? batch.map(nome => ({ nome }))
        : batch.map(valor => ({ chave: key, valor }));
      const conflict = key === "nomes" ? "nome" : "chave,valor";
      await authReady;
      const { error } = await supabase.from(table)
        .upsert(payload, { onConflict: conflict, ignoreDuplicates: true });
      if (error) { setBulkFeedback(`${t("cfg_import_error")} ${error.message}`); return; }
    }

    setOpcoes({ ...opcoes, [key]: [...opcoes[key], ...novos] });
    const s = novos.length > 1 ? "s" : "";
    setBulkFeedback(t("cfg_import_success").replace("{n}", String(novos.length)).replace(/\{s\}/g, s));
    setNomesBulk("");
    setTimeout(() => setBulkFeedback(""), 4000);
  };

  const nomesFiltrados = opcoes.nomes.filter(n => n.toLowerCase().includes(nomeBusca.toLowerCase()));

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#334155", flexShrink: 0 }} />
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>{t("cfg_nomes_title")}</div>
        <div style={{ fontSize: 11, background: "#33415518", color: "#334155", fontWeight: 700, borderRadius: 99, padding: "2px 8px" }}>{opcoes.nomes.length} nomes</div>
        <div style={{ fontSize: 12, color: "#94A3B8", marginLeft: 4 }}>{t("cfg_nomes_desc")}</div>
      </div>

      <div className="rsp-grid-2" style={{ display: "grid", gridTemplateColumns: isAdminOrMod ? "1fr 1fr" : "1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("cfg_nomes_list_label")}</div>
          <input value={nomeBusca} onChange={e => setNomeBusca(e.target.value)} placeholder={t("cfg_nomes_search")} style={{ ...inStyle, flex: "none" }} />
          <div style={{ border: "1px solid #E2E6EC", borderRadius: 8, maxHeight: 260, overflowY: "auto" }}>
            {nomesFiltrados.length === 0 && (
              <div style={{ color: "#94A3B8", fontSize: 12, textAlign: "center", padding: 24 }}>
                {opcoes.nomes.length === 0 ? t("cfg_nomes_none") : t("cfg_nomes_no_result")}
              </div>
            )}
            {nomesFiltrados.map((nome, idx) => {
              const realIdx = opcoes.nomes.indexOf(nome);
              const isEdit = editing?.idx === realIdx;
              return (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", borderBottom: idx < nomesFiltrados.length - 1 ? "1px solid #F1F5F9" : "none", fontSize: 12 }}>
                  {isEdit ? (
                    <input autoFocus value={editing.value}
                      onChange={e => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={e => { if (e.key === "Enter") renameNome(realIdx, editing.value); if (e.key === "Escape") setEditing(null); }}
                      onBlur={() => renameNome(realIdx, editing.value)}
                      style={{ ...inStyle, flex: 1, padding: "3px 6px", fontSize: 12 }} />
                  ) : (
                    <span style={{ color: "#334155", fontWeight: 500, flex: 1 }}>{nome}</span>
                  )}
                  {!isEdit && (
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <button onClick={() => setEditing({ idx: realIdx, value: nome })}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2, display: "flex" }} title="Editar">
                        <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={12} />
                      </button>
                      <button onClick={() => removeNome(realIdx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 2, display: "flex" }}>
                        <Icon d="M18 6L6 18M6 6l12 12" size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={inputNome} onChange={e => setInputNome(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addNome(inputNome)}
              placeholder={t("cfg_nomes_add_ph")} style={inStyle} />
            <button onClick={() => addNome(inputNome)}
              style={{ background: "#334155", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>+</button>
          </div>
        </div>

        {isAdminOrMod && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: .7 }}>{t("cfg_import_label")}</div>
            <select value={bulkCategory} onChange={e => { setBulkCategory(e.target.value as OpcKey); setNomesBulk(""); setBulkFeedback(""); }}
              style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", background: "#FAFBFC", outline: "none", cursor: "pointer" }}>
              <option value="nomes">{t("cfg_nomes_title")}</option>
              {OPCOES_CONFIG.map(({ key }) => (
                <option key={key} value={key}>{t(("cfg_opt_" + key) as Parameters<typeof t>[0])}</option>
              ))}
            </select>
            <textarea value={nomesBulk} onChange={e => setNomesBulk(e.target.value)}
              placeholder={t("cfg_import_ph")}
              style={{ border: "1.5px solid #E2E6EC", borderRadius: 8, padding: "9px 11px", fontSize: 12, fontFamily: "inherit", background: "#FAFBFC", width: "100%", outline: "none", resize: "vertical", minHeight: 220, lineHeight: 1.8 }} />
            <button onClick={() => importItems(bulkCategory)}
              style={{ background: "#1A56DB", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
              {t("cfg_import_btn")}
            </button>
            {bulkFeedback && (
              <div style={{ fontSize: 12, color: "#0E9F6E", fontWeight: 600, background: "#E6F9F4", borderRadius: 7, padding: "7px 12px" }}>{bulkFeedback}</div>
            )}
            <div style={{ fontSize: 11, color: "#94A3B8" }}>{t("cfg_import_hint")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
