import { useEffect, useMemo, useState } from "react";
import { periodosPadrao, type Periodo } from "@/lib/fechamento-utils";

interface Props {
  onChange: (inicio: string, fim: string) => void;
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 20px 40px rgba(26,28,29,0.06)",
  padding: 16,
};

const input: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  outline: "none",
};

const currentYm = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const mesInteiro = (ym: string): Periodo => {
  const [y, m] = ym.split("-").map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  return {
    label: "Mês inteiro",
    inicio: `${ym}-01`,
    fim: `${ym}-${String(ultimoDia).padStart(2, "0")}`,
  };
};

export function ResumoAcumuladoFilters({ onChange }: Props) {
  const [ym, setYm] = useState<string>(currentYm);
  const [periodoIdx, setPeriodoIdx] = useState<number>(0);

  const periodos = useMemo<Periodo[]>(() => {
    return [...periodosPadrao(ym), mesInteiro(ym)];
  }, [ym]);

  const periodoSafe = Math.min(periodoIdx, periodos.length - 1);
  const atual = periodos[periodoSafe];

  useEffect(() => {
    onChange(atual.inicio, atual.fim);
  }, [atual.inicio, atual.fim, onChange]);

  return (
    <div style={card}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#9898B0", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            Mês
          </label>
          <input
            type="month"
            style={input}
            value={ym}
            onChange={e => setYm(e.target.value || currentYm())}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
          <label style={{ fontSize: 11, color: "#9898B0", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            Período
          </label>
          <select
            style={input}
            value={periodoSafe}
            onChange={e => setPeriodoIdx(Number(e.target.value))}
          >
            {periodos.map((p, i) => (
              <option key={`${p.label}-${p.inicio}`} value={i}>
                {p.label} ({p.inicio} → {p.fim})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
