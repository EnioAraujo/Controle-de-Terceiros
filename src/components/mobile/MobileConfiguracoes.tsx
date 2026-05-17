import { useState } from "react";
import type { Opcoes } from "@/types/attendance";

interface Props {
  opcoes: Opcoes;
  addOpcao: (key: keyof Opcoes, valor: string) => Promise<void>;
  removeOpcao: (key: keyof Opcoes, valor: string) => Promise<void>;
}

const cardStyle = {
  background: "#fff", borderRadius: 12, padding: 20,
  boxShadow: "0 1px 3px #00000010",
};

const inputStyle = {
  flex: 1, border: "1.5px solid #E8E8EA", borderRadius: 8,
  padding: "9px 12px", fontSize: 14, fontFamily: "inherit",
  color: "#0F1C2E", background: "#FAFAFA",
};

const addBtnStyle = {
  background: "#F37E38", border: "none", borderRadius: 8,
  padding: "9px 16px", color: "#fff",
  fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer",
};

export function MobileConfiguracoes({ opcoes, addOpcao, removeOpcao }: Props) {
  const [cfgFornInput, setCfgFornInput] = useState("");
  const [cfgNomeInput, setCfgNomeInput] = useState("");
  const [cfgNomeBusca, setCfgNomeBusca] = useState("");

  const nomesFiltrados = opcoes.nomes.filter(
    n => !cfgNomeBusca || n.toLowerCase().includes(cfgNomeBusca.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0F1C2E", marginBottom: 14 }}>Fornecedores</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, minHeight: 32 }}>
          {opcoes.fornecedores.map(f => (
            <span key={f} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#F1F5F9", borderRadius: 8,
              padding: "5px 10px", fontSize: 13, color: "#334155",
            }}>
              {f}
              <button
                onClick={() => void removeOpcao("fornecedores", f)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16, lineHeight: 1, padding: 0 }}
                aria-label={`Remover ${f}`}
              >×</button>
            </span>
          ))}
          {opcoes.fornecedores.length === 0 && (
            <span style={{ color: "#CBD5E1", fontSize: 13 }}>Nenhum fornecedor cadastrado</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={cfgFornInput}
            onChange={e => setCfgFornInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { void addOpcao("fornecedores", cfgFornInput); setCfgFornInput(""); } }}
            placeholder="Novo fornecedor..."
            style={inputStyle}
          />
          <button
            onClick={() => { void addOpcao("fornecedores", cfgFornInput); setCfgFornInput(""); }}
            style={addBtnStyle}
          >+</button>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0F1C2E", marginBottom: 14 }}>Base de Colaboradores</div>
        <input
          value={cfgNomeBusca}
          onChange={e => setCfgNomeBusca(e.target.value)}
          placeholder="Buscar colaborador..."
          style={{
            width: "100%", border: "1.5px solid #E8E8EA", borderRadius: 8,
            padding: "9px 12px", fontSize: 14, fontFamily: "inherit",
            color: "#0F1C2E", background: "#FAFAFA", boxSizing: "border-box",
            marginBottom: 10,
          }}
        />
        <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
          {nomesFiltrados.map(n => (
            <div key={n} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "7px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13, color: "#334155",
            }}>
              {n}
              <button
                onClick={() => void removeOpcao("nomes", n)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                aria-label={`Remover ${n}`}
              >×</button>
            </div>
          ))}
          {nomesFiltrados.length === 0 && (
            <div style={{ color: "#CBD5E1", fontSize: 13, padding: "8px 0" }}>Nenhum colaborador encontrado</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={cfgNomeInput}
            onChange={e => setCfgNomeInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { void addOpcao("nomes", cfgNomeInput); setCfgNomeInput(""); } }}
            placeholder="Novo colaborador..."
            style={inputStyle}
          />
          <button
            onClick={() => { void addOpcao("nomes", cfgNomeInput); setCfgNomeInput(""); }}
            style={addBtnStyle}
          >+</button>
        </div>
      </div>
    </div>
  );
}
