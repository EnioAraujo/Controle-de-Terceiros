import type { Pessoa } from "@/types/hierarquia";

interface Props {
  pessoas: Pessoa[];
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 20px 40px rgba(26,28,29,0.06)",
  padding: 20,
};

export function ContadorPessoas({ pessoas }: Props) {
  const byCargo = pessoas.reduce<Record<string, number>>((acc, p) => {
    const k = p.cargo || "—";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(byCargo).sort((a, b) => b[1] - a[1]);

  return (
    <div style={card}>
      <p style={{ fontSize: 11, color: "#9898B0", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 4 }}>
        Funcionários cadastrados
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: "#212B36" }}>{pessoas.length}</span>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>total</span>
      </div>
      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum funcionário cadastrado.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {entries.map(([cargo, qtd]) => (
            <span
              key={cargo}
              style={{
                background: "#F37E3815",
                color: "#F37E38",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {cargo} <strong style={{ marginLeft: 4 }}>{qtd}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
