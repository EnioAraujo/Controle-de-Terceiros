import { useState, CSSProperties } from "react";
import type { Opcoes, Registro } from "@/types/attendance";
import { OPCOES_CONFIG } from "@/types/attendance";
import { sanitize, logAudit } from "@/lib/audit";
import { KEY_TO_FIELD } from "@/lib/format-utils";
import { Icon } from "@/components/atoms";
import { useI18n } from "@/hooks/use-i18n";

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

export function ConfigOpcoesSection({ opcoes, setOpcoes, registros, setRegistros, isAdminOrMod }: Props) {
  const { t } = useI18n();
  const emptyByKey = { turnos: "", unidades: "", fornecedores: "", motivos: "", cargos: "", ccList: "", nomes: "" };
  const [inputs, setInputs] = useState<Record<OpcKey, string>>(emptyByKey);
  const [editing, setEditing] = useState<{ key: OpcKey; idx: number; value: string } | null>(null);
  const [cardSearch, setCardSearch] = useState<Record<OpcKey, string>>(emptyByKey);

  const addItem = (key: OpcKey, value: string) => {
    const v = sanitize(value.trim().toUpperCase());
    if (!v || opcoes[key].includes(v)) return;
    setOpcoes({ ...opcoes, [key]: [...opcoes[key], v] });
    setInputs(prev => ({ ...prev, [key]: "" }));
  };

  const removeItem = (key: OpcKey, idx: number) => {
    const arr = [...opcoes[key]];
    arr.splice(idx, 1);
    setOpcoes({ ...opcoes, [key]: arr });
  };

  const renameItem = (key: OpcKey, idx: number, newValue: string) => {
    const v = sanitize(newValue.trim().toUpperCase());
    const oldValue = opcoes[key][idx];
    setEditing(null);
    if (!v || v === oldValue || opcoes[key].includes(v)) return;
    const arr = [...opcoes[key]];
    arr[idx] = v;
    setOpcoes({ ...opcoes, [key]: arr });
    const field = KEY_TO_FIELD[key];
    if (field) setRegistros(registros.map(r => r[field] === oldValue ? { ...r, [field]: v } : r));
    logAudit("UPDATE", "opcoes", undefined, { chave: key, valorAnterior: oldValue, valorNovo: v });
  };

  if (!isAdminOrMod) return null;

  return (
    <div className="rsp-grid-autofill" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
      {OPCOES_CONFIG.map(({ key, cor }) => {
        const items = opcoes[key];
        const search = cardSearch[key];
        const filtered = search ? items.filter(v => v.toLowerCase().includes(search.toLowerCase())) : items;
        return (
          <div key={key} style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: cor, flexShrink: 0 }} />
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>{t(("cfg_opt_" + key) as Parameters<typeof t>[0])}</div>
              <div style={{ marginLeft: "auto", fontSize: 11, background: cor + "18", color: cor, fontWeight: 700, borderRadius: 99, padding: "2px 8px" }}>{items.length}</div>
            </div>
            {items.length > 3 && (
              <input value={search} onChange={e => setCardSearch(p => ({ ...p, [key]: e.target.value }))}
                placeholder={t("cfg_opt_search")}
                style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontFamily: "inherit", outline: "none", background: "#FAFBFC" }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 200, overflowY: "auto" }}>
              {items.length === 0 && <div style={{ color: "#CBD5E1", fontSize: 11, textAlign: "center", padding: "10px 0" }}>{t("cfg_opt_empty")}</div>}
              {filtered.map((item) => {
                const realIdx = items.indexOf(item);
                const isEdit = editing?.key === key && editing?.idx === realIdx;
                return (
                  <div key={realIdx} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px", background: "#F8FAFC", borderRadius: 6, fontSize: 12 }}>
                    {isEdit ? (
                      <input autoFocus value={editing.value}
                        onChange={e => setEditing({ ...editing, value: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") renameItem(key, realIdx, editing.value); if (e.key === "Escape") setEditing(null); }}
                        onBlur={() => renameItem(key, realIdx, editing.value)}
                        style={{ ...inStyle, flex: 1, padding: "3px 6px", fontSize: 12 }} />
                    ) : (
                      <span style={{ color: "#334155", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item}</span>
                    )}
                    {!isEdit && (
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button onClick={() => setEditing({ key, idx: realIdx, value: item })}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2, display: "flex", lineHeight: 1 }} title="Editar">
                          <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={12} />
                        </button>
                        <button onClick={() => removeItem(key, realIdx)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 2, display: "flex", lineHeight: 1 }}>
                          <Icon d="M18 6L6 18M6 6l12 12" size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={inputs[key]} onChange={e => setInputs(p => ({ ...p, [key]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addItem(key, inputs[key])}
                placeholder={t("cfg_opt_placeholder")} style={inStyle} />
              <button onClick={() => addItem(key, inputs[key])}
                style={{ background: cor, border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
