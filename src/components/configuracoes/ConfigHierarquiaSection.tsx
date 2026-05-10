import { useState, CSSProperties } from "react";
import type { CC, Hierarquia, Unidade } from "@/types/hierarquia";
import type { HierarquiaApi } from "@/hooks/useHierarquia";
import { sanitize } from "@/lib/audit";
import { Icon } from "@/components/atoms";

interface Props {
  hierarquia: Hierarquia;
  api: HierarquiaApi;
  isAdminOrMod: boolean;
}

const inStyle: CSSProperties = {
  border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "6px 10px",
  fontSize: 12, fontFamily: "inherit", outline: "none", background: "#FAFBFC", flex: 1,
};

const norm = (s: string) => sanitize(s.trim().toUpperCase());

export function ConfigHierarquiaSection({ hierarquia, api, isAdminOrMod }: Props) {
  const [openUnidades, setOpenUnidades] = useState<Set<number>>(new Set());
  const [openCcs, setOpenCcs]           = useState<Set<number>>(new Set());
  const [novaUnidade, setNovaUnidade]   = useState("");
  const [novoCC, setNovoCC]             = useState<Record<number, string>>({});
  const [novaOp, setNovaOp]             = useState<Record<number, string>>({});

  if (!isAdminOrMod) return null;

  const toggleSet = (set: Set<number>, id: number, setter: (s: Set<number>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const handleAddUnidade = async () => {
    const v = norm(novaUnidade);
    if (!v || hierarquia.unidades.some(u => u.nome === v)) return;
    await api.addUnidade(v);
    setNovaUnidade("");
  };

  const handleAddCC = async (unidade: Unidade) => {
    const v = norm(novoCC[unidade.id] ?? "");
    if (!v || unidade.ccs.some(c => c.codigo === v)) return;
    await api.addCC(unidade.id, v);
    setNovoCC(prev => ({ ...prev, [unidade.id]: "" }));
  };

  const handleAddOp = async (cc: CC) => {
    const v = norm(novaOp[cc.id] ?? "");
    if (!v || cc.operacoes.some(o => o.nome === v)) return;
    await api.addOperacao(cc.id, v);
    setNovaOp(prev => ({ ...prev, [cc.id]: "" }));
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0E9F6E", flexShrink: 0 }} />
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>Hierarquia: Unidade → CC → Operação</div>
        <div style={{ fontSize: 11, background: "#0E9F6E18", color: "#0E9F6E", fontWeight: 700, borderRadius: 99, padding: "2px 8px" }}>{hierarquia.unidades.length} unidades</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input value={novaUnidade} onChange={e => setNovaUnidade(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAddUnidade()}
          placeholder="Nova unidade..." style={inStyle} />
        <button onClick={handleAddUnidade}
          style={{ background: "#0E9F6E", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13 }}>+ Unidade</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {hierarquia.unidades.length === 0 && (
          <div style={{ color: "#CBD5E1", fontSize: 12, textAlign: "center", padding: 20 }}>Nenhuma unidade cadastrada.</div>
        )}
        {hierarquia.unidades.map(u => (
          <UnidadeRow key={u.id} unidade={u}
            expanded={openUnidades.has(u.id)} onToggle={() => toggleSet(openUnidades, u.id, setOpenUnidades)}
            openCcs={openCcs} setOpenCcs={setOpenCcs}
            api={api}
            novoCC={novoCC[u.id] ?? ""} setNovoCC={v => setNovoCC(prev => ({ ...prev, [u.id]: v }))}
            handleAddCC={() => handleAddCC(u)}
            novaOp={novaOp} setNovaOp={setNovaOp}
            handleAddOp={handleAddOp}
          />
        ))}
      </div>
    </div>
  );
}

interface UnidadeRowProps {
  unidade: Unidade;
  expanded: boolean;
  onToggle: () => void;
  openCcs: Set<number>;
  setOpenCcs: (s: Set<number>) => void;
  api: HierarquiaApi;
  novoCC: string;
  setNovoCC: (v: string) => void;
  handleAddCC: () => void;
  novaOp: Record<number, string>;
  setNovaOp: (fn: (prev: Record<number, string>) => Record<number, string>) => void;
  handleAddOp: (cc: CC) => Promise<void>;
}

function UnidadeRow({ unidade: u, expanded, onToggle, openCcs, setOpenCcs, api, novoCC, setNovoCC, handleAddCC, novaOp, setNovaOp, handleAddOp }: UnidadeRowProps) {
  const ccCount = u.ccs.length;
  const opCount = u.ccs.reduce((acc, c) => acc + c.operacoes.length, 0);

  return (
    <div style={{ border: "1px solid #E2E6EC", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#F8FAFC", borderRadius: expanded ? "8px 8px 0 0" : 8, cursor: "pointer" }}
        onClick={onToggle}>
        <Icon d={expanded ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} size={12} />
        <span style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E", flex: 1 }}>{u.nome}</span>
        <span style={{ fontSize: 11, color: "#64748B" }}>{ccCount} CC · {opCount} op</span>
        <InlineActions
          onRename={async () => {
            const v = prompt("Renomear unidade:", u.nome);
            if (v) await api.renameUnidade(u.id, norm(v));
          }}
          onDelete={async () => {
            if (confirm(`Excluir unidade "${u.nome}" e todos seus CCs/operações?`)) await api.deleteUnidade(u.id);
          }}
        />
      </div>
      {expanded && (
        <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={novoCC} onChange={e => setNovoCC(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddCC()}
              placeholder="Novo CC..." style={{ ...inStyle, fontSize: 11 }} />
            <button onClick={handleAddCC}
              style={{ background: "#0891B2", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 12 }}>+ CC</button>
          </div>
          {u.ccs.map(c => (
            <CCRow key={c.id} cc={c}
              expanded={openCcs.has(c.id)}
              onToggle={() => {
                const next = new Set(openCcs);
                if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                setOpenCcs(next);
              }}
              api={api}
              novaOp={novaOp[c.id] ?? ""}
              setNovaOp={v => setNovaOp(prev => ({ ...prev, [c.id]: v }))}
              handleAddOp={() => handleAddOp(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CCRowProps {
  cc: CC;
  expanded: boolean;
  onToggle: () => void;
  api: HierarquiaApi;
  novaOp: string;
  setNovaOp: (v: string) => void;
  handleAddOp: () => void;
}

function CCRow({ cc: c, expanded, onToggle, api, novaOp, setNovaOp, handleAddOp }: CCRowProps) {
  return (
    <div style={{ border: "1px solid #F1F5F9", borderRadius: 7, marginLeft: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: "pointer" }} onClick={onToggle}>
        <Icon d={expanded ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} size={11} />
        <span style={{ fontWeight: 600, fontSize: 12, color: "#0891B2", flex: 1 }}>{c.codigo}</span>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>{c.operacoes.length} op</span>
        <InlineActions
          onRename={async () => {
            const v = prompt("Renomear CC:", c.codigo);
            if (v) await api.renameCC(c.id, norm(v));
          }}
          onDelete={async () => {
            if (confirm(`Excluir CC "${c.codigo}" e todas suas operações?`)) await api.deleteCC(c.id);
          }}
        />
      </div>
      {expanded && (
        <div style={{ padding: "0 10px 8px 32px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={novaOp} onChange={e => setNovaOp(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddOp()}
              placeholder="Nova operação..." style={{ ...inStyle, fontSize: 11, padding: "4px 8px" }} />
            <button onClick={handleAddOp}
              style={{ background: "#6C63FF", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 11 }}>+</button>
          </div>
          {c.operacoes.length === 0 && (
            <div style={{ color: "#CBD5E1", fontSize: 11, padding: "4px 0" }}>Sem operações.</div>
          )}
          {c.operacoes.map(op => (
            <div key={op.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", background: "#F8FAFC", borderRadius: 5, fontSize: 11 }}>
              <span style={{ color: "#475569", flex: 1 }}>{op.nome}</span>
              <InlineActions
                onRename={async () => {
                  const v = prompt("Renomear operação:", op.nome);
                  if (v) await api.renameOperacao(op.id, norm(v));
                }}
                onDelete={async () => {
                  if (confirm(`Excluir operação "${op.nome}"?`)) await api.deleteOperacao(op.id);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineActions({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <button onClick={onRename} title="Renomear"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2, display: "flex" }}>
        <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={11} />
      </button>
      <button onClick={onDelete} title="Excluir"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 2, display: "flex" }}>
        <Icon d="M18 6L6 18M6 6l12 12" size={11} />
      </button>
    </div>
  );
}
